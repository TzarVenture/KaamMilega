package chat

import (
	"context"
	"errors"
	"fmt"
	"km-backend/internal/common/apperr"
	"math"
	"strings"
	"time"

	"km-backend/internal/features/user"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type service struct {
	repo     ChatRepository
	userRepo user.UserRepository
	hub      *Hub
}

func NewService(repo ChatRepository, userRepo user.UserRepository, hub *Hub) ChatService {
	return &service{
		repo:     repo,
		userRepo: userRepo,
		hub:      hub,
	}
}

func (s *service) GetConversations(ctx context.Context, userID primitive.ObjectID) ([]ConversationResponse, error) {
	convs, err := s.repo.GetConversationsByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	responses := make([]ConversationResponse, 0, len(convs))
	for _, c := range convs {
		// LinkedIn rule: If the user cleared/deleted this conversation, check if any newer message arrived
		if c.ClearedAt != nil {
			if clearedTime, ok := c.ClearedAt[userID.Hex()]; ok {
				if !c.UpdatedAt.After(clearedTime) {
					// Conversation was deleted by this user and has no newer activity: skip from inbox!
					continue
				}
			}
		}

		var otherID primitive.ObjectID
		for _, p := range c.Participants {
			if p != userID {
				otherID = p
				break
			}
		}

		var otherUser *ParticipantInfo
		if !otherID.IsZero() && s.userRepo != nil {
			if u, err := s.userRepo.FindUserByID(ctx, otherID.Hex()); err == nil && u != nil {
				name := strings.TrimSpace(u.Name)
				if name == "" {
					name = strings.TrimSpace(u.FirstName + " " + u.LastName)
				}
				if name == "" {
					name = "User"
				}

				isOnline := false
				if s.hub != nil {
					isOnline = s.hub.IsOnline(otherID.Hex())
				}

				roles := u.Roles
				if len(roles) == 0 {
					roles = []string{"user"}
				}

				otherUser = &ParticipantInfo{
					ID:           otherID.Hex(),
					Name:         name,
					ProfileImage: u.ProfileImage,
					Headline:     u.Headline,
					Roles:        roles,
					IsOnline:     isOnline,
				}
				// History stays readable, but the other person is shown as unavailable and can't be messaged
				if !user.IsActiveAccount(u.AccountStatus) {
					otherUser = &ParticipantInfo{
						ID:          otherID.Hex(),
						Name:        "KaamMilega member",
						Roles:       []string{"user"},
						Unavailable: true,
					}
				}
			}
		}

		unreadCount, _ := s.repo.CountUnreadMessages(ctx, c.ID, userID)

		responses = append(responses, ConversationResponse{
			ID:            c.ID,
			Participants:  c.Participants,
			LastMessageID: c.LastMessageID,
			LastMessage:   c.LastMessage,
			UpdatedAt:     c.UpdatedAt,
			CreatedAt:     c.CreatedAt,
			OtherUser:     otherUser,
			UnreadCount:   unreadCount,
		})
	}

	return responses, nil
}

// ErrRecipientUnavailable: the receiver does not exist or is deactivated, pending deletion or deleted
var ErrRecipientUnavailable = apperr.New("RECIPIENT_UNAVAILABLE", "This member isn't available on KaamMilega right now, so you can't message them.")

// ErrMessageSelf: a conversation needs two different people
var ErrMessageSelf = apperr.New("MESSAGE_SELF", "You can't send a message to yourself.")

// ErrAttachmentInvalid: an attachment is not a chat file this sender uploaded
var ErrAttachmentInvalid = apperr.New("CHAT_ATTACHMENT_INVALID", "One of the files couldn't be attached. Please upload it again.")

// ErrTooManyAttachments: more than MaxAttachments files in one message
var ErrTooManyAttachments = apperr.New("CHAT_TOO_MANY_ATTACHMENTS", "You can send up to 10 files at a time.")

// ErrReplyInvalid: the quoted message is not in this conversation
var ErrReplyInvalid = apperr.New("CHAT_REPLY_INVALID", "The message you're replying to isn't available.")

// IsBadRequest reports errors caused by the request itself (HTTP 400)
func IsBadRequest(err error) bool {
	return errors.Is(err, ErrMessageSelf) || errors.Is(err, ErrAttachmentInvalid) ||
		errors.Is(err, ErrTooManyAttachments) || errors.Is(err, ErrReplyInvalid)
}

// attachmentRefs collects the file references of a request, old single-file form included
func attachmentRefs(req CreateMessageRequest) []string {
	refs := make([]string, 0, len(req.Attachments)+1)
	for _, a := range req.Attachments {
		if a.URL != "" {
			refs = append(refs, a.URL)
		}
	}
	if len(refs) == 0 && req.AttachmentURL != "" {
		refs = append(refs, req.AttachmentURL)
	}
	return refs
}

// lastMessagePreview is the line shown under the name in the conversation list
func lastMessagePreview(content string, atts []Attachment) string {
	if content != "" || len(atts) == 0 {
		return content
	}
	images := 0
	for _, a := range atts {
		if strings.HasPrefix(a.Type, "image/") {
			images++
		}
	}
	switch {
	case len(atts) == 1 && images == 1:
		return "Photo"
	case len(atts) == 1:
		return "Attachment: " + atts[0].Name
	case images == len(atts):
		return fmt.Sprintf("%d photos", images)
	default:
		return fmt.Sprintf("%d files", len(atts))
	}
}

// replyPreview copies what the quote shows from the original message
func replyPreview(orig *Message) *ReplyPreview {
	p := &ReplyPreview{ID: orig.ID, SenderID: orig.SenderID, IsDeleted: orig.IsDeleted}
	if orig.IsDeleted {
		return p
	}
	content := []rune(orig.Content)
	if len(content) > 200 {
		content = append(content[:200], '…')
	}
	p.Content = string(content)
	atts := orig.Attachments
	if len(atts) == 0 && orig.AttachmentURL != "" {
		atts = []Attachment{{URL: orig.AttachmentURL, Type: orig.AttachmentType, Name: orig.AttachmentName}}
	}
	if len(atts) > 0 {
		p.AttachmentType = atts[0].Type
		p.AttachmentName = atts[0].Name
		p.AttachmentCount = len(atts)
		if strings.HasPrefix(atts[0].Type, "image/") {
			p.ThumbURL = atts[0].URL
		}
	}
	return p
}

func (s *service) SendMessage(ctx context.Context, senderID primitive.ObjectID, req CreateMessageRequest) (*Message, error) {
	if req.ReceiverID == senderID {
		return nil, ErrMessageSelf
	}
	if s.userRepo != nil {
		receiver, err := s.userRepo.FindUserByID(ctx, req.ReceiverID.Hex())
		if err != nil || receiver == nil || !user.IsActiveAccount(receiver.AccountStatus) {
			return nil, ErrRecipientUnavailable
		}
	}

	// Safety & Trust: Check if either party blocked the other
	blocked, err := s.repo.IsBlockedEitherWay(ctx, senderID, req.ReceiverID)
	if err != nil {
		return nil, err
	}
	if blocked {
		return nil, errors.New("cannot send message: messaging is blocked between these users")
	}

	refs := attachmentRefs(req)
	if len(refs) > MaxAttachments {
		return nil, ErrTooManyAttachments
	}

	// 1. Find or create conversation
	participants := []primitive.ObjectID{senderID, req.ReceiverID}
	conv, err := s.repo.GetConversationByParticipants(ctx, participants)

	if err != nil {
		return nil, err
	}

	created := false
	if conv == nil {
		// Entitlement Gate: 3 distinct person chats free. 4th onwards requires active ₹99 Pass
		canStart, err := s.repo.CanInitiateNewConversation(ctx, senderID)
		if err != nil {
			return nil, err
		}
		if !canStart {
			return nil, apperr.New("CHAT_QUOTA_REACHED", "free chat quota reached: you have connected with 3 people for free. Unlock unlimited networking and 10 work credits with the ₹99 Universal Pass")
		}

		conv, err = s.repo.CreateConversation(ctx, participants)
		if err != nil {
			return nil, err
		}
		created = true
	}
	// A first message that fails its checks leaves no empty conversation behind
	fail := func(err error) (*Message, error) {
		if created {
			_ = s.repo.DeleteConversation(ctx, conv.ID)
		}
		return nil, err
	}

	// Files must be the sender's own chat uploads; this also lets the receiver open them
	var atts []Attachment
	if len(refs) > 0 {
		if atts, err = s.repo.ClaimChatFiles(ctx, senderID, conv.ID, refs); err != nil {
			return fail(err)
		}
	}

	var reply *ReplyPreview
	if req.ReplyToID != "" {
		origID, err := primitive.ObjectIDFromHex(req.ReplyToID)
		if err != nil {
			return fail(ErrReplyInvalid)
		}
		orig, err := s.repo.GetMessageByID(ctx, origID)
		if err != nil || orig == nil || orig.ConversationID != conv.ID {
			return fail(ErrReplyInvalid)
		}
		reply = replyPreview(orig)
	}

	// 2. Create message
	msg := &Message{
		ConversationID: conv.ID,
		SenderID:       senderID,
		Content:        req.Content,
		Attachments:    atts,
		ReplyTo:        reply,
		IsRead:         false,
	}
	if len(atts) > 0 {
		msg.AttachmentURL = atts[0].URL
		msg.AttachmentType = atts[0].Type
		msg.AttachmentName = atts[0].Name
		msg.AttachmentSize = atts[0].Size
	}
	lastPreview := lastMessagePreview(req.Content, atts)

	createdMsg, err := s.repo.CreateMessage(ctx, msg)
	if err != nil {
		return nil, err
	}

	// 3. Update conversation with last message
	_ = s.repo.UpdateLastMessage(ctx, conv.ID, createdMsg.ID, lastPreview)

	return createdMsg, nil
}

func (s *service) GetMessages(ctx context.Context, conversationID primitive.ObjectID, userID primitive.ObjectID, limit int, beforeID *primitive.ObjectID) ([]Message, error) {
	conv, err := s.repo.GetConversationByID(ctx, conversationID)
	if err != nil {
		return nil, err
	}

	isParticipant := false
	for _, p := range conv.Participants {
		if p == userID {
			isParticipant = true
			break
		}
	}

	if !isParticipant {
		return nil, nil
	}

	var since *time.Time
	if conv.ClearedAt != nil {
		if clearedTime, ok := conv.ClearedAt[userID.Hex()]; ok {
			since = &clearedTime
		}
	}

	return s.repo.GetMessagesByConversationID(ctx, conversationID, limit, beforeID, since)
}

func (s *service) GetTotalUnreadCount(ctx context.Context, userID primitive.ObjectID) (int, error) {
	conversations, err := s.GetConversations(ctx, userID)
	if err != nil {
		return 0, err
	}
	total := 0
	for _, conv := range conversations {
		total += conv.UnreadCount
	}
	return total, nil
}

func (s *service) MarkConversationAsRead(ctx context.Context, conversationID, userID primitive.ObjectID) error {
	return s.repo.MarkMessagesAsRead(ctx, conversationID, userID)
}

func (s *service) DeleteMessage(ctx context.Context, messageID, userID primitive.ObjectID) error {
	msg, err := s.repo.GetMessageByID(ctx, messageID)
	if err != nil {
		return err
	}
	if msg == nil {
		return errors.New("message not found")
	}

	// STRICT LINKEDIN RULE: Only the sender can delete their own message!
	if msg.SenderID != userID {
		return errors.New("unauthorized: you can only delete your own messages")
	}

	conv, err := s.repo.GetConversationByID(ctx, msg.ConversationID)
	if err != nil || conv == nil {
		return errors.New("conversation not found")
	}

	// Mark as deleted (tombstone) rather than hard-deleting
	if err := s.repo.MarkMessageDeleted(ctx, messageID); err != nil {
		return err
	}

	if conv.LastMessageID == messageID {
		_ = s.repo.UpdateLastMessage(ctx, conv.ID, conv.LastMessageID, "This message was deleted")
	}

	for _, p := range conv.Participants {
		s.hub.Send(p.Hex(), map[string]interface{}{
			"type":            "MESSAGE_DELETED",
			"message_id":      messageID.Hex(),
			"conversation_id": conv.ID.Hex(),
		})
	}

	return nil
}

func (s *service) DeleteConversation(ctx context.Context, conversationID, userID primitive.ObjectID) error {
	conv, err := s.repo.GetConversationByID(ctx, conversationID)
	if err != nil || conv == nil {
		return errors.New("conversation not found")
	}
	isParticipant := false
	for _, p := range conv.Participants {
		if p == userID {
			isParticipant = true
			break
		}
	}
	if !isParticipant {
		return errors.New("unauthorized")
	}

	// LinkedIn rule: Remove/hide conversation only for the requesting user
	if err := s.repo.ClearConversationForUser(ctx, conversationID, userID); err != nil {
		return err
	}

	// Notify only the requesting user's client to remove it from their inbox
	s.hub.Send(userID.Hex(), map[string]interface{}{
		"type":            "CONVERSATION_DELETED",
		"conversation_id": conversationID.Hex(),
	})

	return nil
}

func (s *service) ClearMessages(ctx context.Context, conversationID, userID primitive.ObjectID) error {
	return s.DeleteConversation(ctx, conversationID, userID)
}

// Block & Safety service methods

func (s *service) BlockUser(ctx context.Context, userID, targetUserID primitive.ObjectID) error {
	if userID == targetUserID {
		return errors.New("cannot block yourself")
	}
	err := s.repo.BlockUser(ctx, userID, targetUserID)
	if err != nil {
		return err
	}

	// Notify both users in real-time over WebSocket so their chat UIs update instantly
	if s.hub != nil {
		s.hub.Send(userID.Hex(), fiber.Map{
			"type":            "USER_BLOCKED",
			"blocked_user_id": targetUserID.Hex(),
			"blocked_by_me":   true,
		})
		s.hub.Send(targetUserID.Hex(), fiber.Map{
			"type":            "USER_BLOCKED",
			"blocked_user_id": userID.Hex(),
			"blocked_by_me":   false,
		})
	}
	return nil
}

func (s *service) UnblockUser(ctx context.Context, userID, targetUserID primitive.ObjectID) error {
	err := s.repo.UnblockUser(ctx, userID, targetUserID)
	if err != nil {
		return err
	}

	if s.hub != nil {
		s.hub.Send(userID.Hex(), fiber.Map{
			"type":              "USER_UNBLOCKED",
			"unblocked_user_id": targetUserID.Hex(),
			"unblocked_by_me":   true,
		})
		s.hub.Send(targetUserID.Hex(), fiber.Map{
			"type":              "USER_UNBLOCKED",
			"unblocked_user_id": userID.Hex(),
			"unblocked_by_me":   false,
		})
	}
	return nil
}

func (s *service) GetBlockStatus(ctx context.Context, userID, otherUserID primitive.ObjectID) (*BlockStatusResponse, error) {
	byMe, byOther, err := s.repo.GetBlockStatus(ctx, userID, otherUserID)
	if err != nil {
		return nil, err
	}
	return &BlockStatusResponse{
		IsBlockedByMe:    byMe,
		IsBlockedByOther: byOther,
	}, nil
}

// Report & Moderation service methods

func (s *service) CreateChatReport(ctx context.Context, reporterID, conversationID primitive.ObjectID, req CreateReportRequest) (*ChatReport, error) {
	conv, err := s.repo.GetConversationByID(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	if conv == nil {
		return nil, errors.New("conversation not found")
	}

	var targetUserID primitive.ObjectID
	for _, p := range conv.Participants {
		if p != reporterID {
			targetUserID = p
			break
		}
	}
	if targetUserID.IsZero() {
		return nil, errors.New("cannot identify reported user in this conversation")
	}

	reporterName := "User"
	reporterRole := "user"
	if s.userRepo != nil {
		if u, err := s.userRepo.FindUserByID(ctx, reporterID.Hex()); err == nil && u != nil {
			if u.Name != "" {
				reporterName = u.Name
			} else if u.FirstName != "" {
				reporterName = strings.TrimSpace(u.FirstName + " " + u.LastName)
			}
			if len(u.Roles) > 0 {
				reporterRole = u.Roles[0]
			}
		}
	}

	targetUserName := "User"
	targetUserRole := "user"
	if s.userRepo != nil {
		if u, err := s.userRepo.FindUserByID(ctx, targetUserID.Hex()); err == nil && u != nil {
			if u.Name != "" {
				targetUserName = u.Name
			} else if u.FirstName != "" {
				targetUserName = strings.TrimSpace(u.FirstName + " " + u.LastName)
			}
			if len(u.Roles) > 0 {
				targetUserRole = u.Roles[0]
			}
		}
	}

	// Capture recent conversation messages as evidence snapshot
	evidenceMessages, _ := s.repo.GetMessagesByConversationID(ctx, conversationID, 25, nil, nil)
	evidence := make([]ReportedMessageSnapshot, 0, len(evidenceMessages))
	for _, m := range evidenceMessages {
		senderName := targetUserName
		if m.SenderID == reporterID {
			senderName = reporterName
		}
		evidence = append(evidence, ReportedMessageSnapshot{
			ID:            m.ID,
			SenderID:      m.SenderID,
			SenderName:    senderName,
			Content:       m.Content,
			AttachmentURL: m.AttachmentURL,
			CreatedAt:     m.CreatedAt,
		})
	}

	report := &ChatReport{
		ReporterID:       reporterID,
		ReporterName:     reporterName,
		ReporterRole:     reporterRole,
		ReportedUserID:   targetUserID,
		ReportedUserName: targetUserName,
		ReportedUserRole: targetUserRole,
		ConversationID:   conversationID,
		Reason:           req.Reason,
		Description:      req.Description,
		Evidence:         evidence,
		Status:           "pending",
	}

	createdReport, err := s.repo.CreateChatReport(ctx, report)
	if err != nil {
		return nil, err
	}

	// If user also opted to block this user simultaneously
	if req.BlockUser {
		_ = s.BlockUser(ctx, reporterID, targetUserID)
	}

	return createdReport, nil
}

func (s *service) GetAdminChatReports(ctx context.Context, status string, page, limit int) (*ChatReportListResponse, error) {
	reports, total, err := s.repo.GetChatReports(ctx, status, page, limit)
	if err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 15
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages < 1 {
		totalPages = 1
	}

	return &ChatReportListResponse{
		Reports:    reports,
		Total:      total,
		Page:       page,
		TotalPages: totalPages,
	}, nil
}

func (s *service) GetAdminChatReportByID(ctx context.Context, id primitive.ObjectID) (*ChatReport, error) {
	return s.repo.GetChatReportByID(ctx, id)
}

func (s *service) ResolveAdminChatReport(ctx context.Context, id, adminID primitive.ObjectID, adminName string, req ResolveReportRequest) error {
	report, err := s.repo.GetChatReportByID(ctx, id)
	if err != nil {
		return err
	}
	if report == nil {
		return errors.New("report not found")
	}

	err = s.repo.ResolveChatReport(ctx, id, req.Status, req.ActionTaken, req.AdminNotes, &adminID, adminName)
	if err != nil {
		return err
	}

	// If admin action is to suspend the user, update their verification status
	if req.ActionTaken == "user_suspended" && s.userRepo != nil {
		if accusedUser, err := s.userRepo.FindUserByID(ctx, report.ReportedUserID.Hex()); err == nil && accusedUser != nil {
			accusedUser.VerificationStatus = "suspended"
			_, _ = s.userRepo.UpdateUser(ctx, accusedUser)
		}
	}

	return nil
}

// GetChatEntitlement retrieves user's chat count, free quota remaining, and active pass status
func (s *service) GetChatEntitlement(ctx context.Context, userID primitive.ObjectID) (*ChatEntitlementResponse, error) {
	return s.repo.GetChatEntitlement(ctx, userID)
}
