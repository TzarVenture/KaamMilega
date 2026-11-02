/** One file of a chat message. `url` is the private /api/files/{id} reference once uploaded. */
export interface ChatAttachment {
  url: string;
  type: string;
  name: string;
  size: number;
  // Only while sending from this browser
  localUrl?: string;
  file?: File;
  progress?: number;
}

/** Copy of the message being replied to, as stored by the server */
export interface ReplyPreview {
  id: string;
  sender_id: string;
  content?: string;
  attachment_type?: string;
  attachment_name?: string;
  attachment_count?: number;
  thumb_url?: string;
  is_deleted?: boolean;
}

export interface MessageLike {
  content?: string;
  is_deleted?: boolean;
  attachments?: ChatAttachment[];
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  attachment_size?: number;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export const isImageAttachment = (a: Pick<ChatAttachment, "type" | "name" | "url">) =>
  a.type.startsWith("image/") || IMAGE_EXT.test(a.name) || IMAGE_EXT.test(a.url);

/** Every file of a message; older messages carry a single attachment_* set */
export function attachmentsOf(m: MessageLike): ChatAttachment[] {
  if (m.attachments?.length) return m.attachments;
  if (!m.attachment_url) return [];
  return [
    {
      url: m.attachment_url,
      type: m.attachment_type || "",
      name: m.attachment_name || "",
      size: m.attachment_size || 0,
    },
  ];
}

/** What a reply quote shows for a message that is still on screen */
export function replyPreviewOf(m: MessageLike & { id: string; sender_id: string }): ReplyPreview {
  const atts = attachmentsOf(m);
  const first = atts[0];
  return {
    id: m.id,
    sender_id: m.sender_id,
    content: m.content,
    is_deleted: m.is_deleted,
    attachment_type: first?.type,
    attachment_name: first?.name,
    attachment_count: atts.length || undefined,
    thumb_url: first && isImageAttachment(first) ? first.localUrl || first.url : undefined,
  };
}

export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
