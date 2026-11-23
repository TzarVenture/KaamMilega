package wallet

import (
	"context"
	"errors"

	"km-backend/internal/common/money"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CategoryCashback is coupon cashback credited to the bonus balance, and its reversal on refund.
const CategoryCashback TransactionCategory = "cashback"

// Ledger metadata on the bonus half of a split purchase. The row whose reference is the
// purchase's own reference is the purchase; the bonus half points back to it.
const (
	metaSplitOf    = "split_of"
	metaBonusPaise = "bonus_paise"
)

// SpendInput is a purchase paid from the wallet. Bonus credit is spent first, then the main
// balance. ReferenceID names the purchase and makes repeats free, like RecordTransactionInput.
type SpendInput struct {
	UserID      primitive.ObjectID
	Category    TransactionCategory
	AmountPaise int64
	ReferenceID string
	Description string
	Metadata    map[string]interface{}
}

// SpendResult says how a purchase was paid.
type SpendResult struct {
	BonusPaise int64
	MainPaise  int64
	// Purchase is the ledger row that names the purchase (main if any main money was used,
	// otherwise bonus). It is nil when there was nothing to pay.
	Purchase *WalletTransaction
	Summary  *WalletSummaryResponse
}

// SpendSplit is how a price would be paid from these balances: bonus first, then main.
func SpendSplit(pricePaise, bonusPaise, mainPaise int64) (fromBonus, fromMain int64, ok bool) {
	if pricePaise <= 0 {
		return 0, 0, true
	}
	fromBonus = min(max(bonusPaise, 0), pricePaise)
	fromMain = pricePaise - fromBonus
	return fromBonus, fromMain, fromMain <= max(mainPaise, 0)
}

// Spend pays for a purchase from the wallet. It joins the caller's transaction, so the purchase
// and its payment commit together. A zero amount posts nothing.
func (s *WalletServiceImpl) Spend(ctx context.Context, in SpendInput) (*SpendResult, error) {
	if in.UserID.IsZero() {
		return nil, errors.New("invalid user id")
	}
	if in.AmountPaise < 0 {
		return nil, errors.New("amount can't be negative")
	}
	if in.ReferenceID == "" {
		return nil, errors.New("a transaction reference is required")
	}

	res := &SpendResult{}
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		*res = SpendResult{}
		w, err := s.repo.LockWallet(ctx, in.UserID)
		if err != nil {
			return err
		}
		if in.AmountPaise == 0 {
			res.Summary = formatWalletSummary(w)
			return nil
		}

		// Paid already: return what was charged then, whatever the balances are now
		if done, err := s.repo.GetTransactionByReference(ctx, in.ReferenceID); err != nil {
			return err
		} else if done != nil {
			return s.describeSpend(ctx, in, done, res)
		}

		fromBonus, fromMain, ok := SpendSplit(in.AmountPaise, w.BonusPaise, w.MainPaise)
		if !ok {
			return ErrInsufficient
		}

		meta := copyMeta(in.Metadata)
		if fromBonus > 0 && fromMain > 0 {
			meta[metaBonusPaise] = fromBonus
			bonusMeta := copyMeta(in.Metadata)
			bonusMeta[metaSplitOf] = in.ReferenceID
			if _, _, err := s.repo.RecordAtomicTransaction(ctx, RecordTransactionInput{
				UserID:        in.UserID,
				Type:          TypeDebit,
				TargetBalance: BalanceBonus,
				Category:      in.Category,
				Amount:        money.ToRupees(fromBonus),
				ReferenceID:   in.ReferenceID + ":bonus",
				Description:   in.Description + " (bonus credit)",
				Metadata:      bonusMeta,
			}); err != nil {
				return err
			}
		}

		target, amount := BalanceMain, fromMain
		if fromMain == 0 {
			target, amount = BalanceBonus, fromBonus
		}
		purchase, updated, err := s.repo.RecordAtomicTransaction(ctx, RecordTransactionInput{
			UserID:        in.UserID,
			Type:          TypeDebit,
			TargetBalance: target,
			Category:      in.Category,
			Amount:        money.ToRupees(amount),
			ReferenceID:   in.ReferenceID,
			Description:   in.Description,
			Metadata:      meta,
		})
		if err != nil {
			return err
		}
		res.BonusPaise, res.MainPaise = fromBonus, fromMain
		res.Purchase = purchase
		res.Summary = formatWalletSummary(updated)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}

// describeSpend rebuilds the result of a purchase that was already paid.
func (s *WalletServiceImpl) describeSpend(ctx context.Context, in SpendInput, purchase *WalletTransaction, res *SpendResult) error {
	if purchase.UserID != in.UserID || purchase.Type != TypeDebit || purchase.Category != in.Category {
		return ErrReferenceConflict
	}
	var bonusHalf int64
	if purchase.TargetBalance == BalanceMain {
		half, err := s.repo.GetTransactionByReference(ctx, in.ReferenceID+":bonus")
		if err != nil {
			return err
		}
		if half != nil {
			bonusHalf = half.AmountPaise
		}
	}
	switch purchase.TargetBalance {
	case BalanceMain:
		res.MainPaise, res.BonusPaise = purchase.AmountPaise, bonusHalf
	case BalanceBonus:
		res.BonusPaise = purchase.AmountPaise
	default:
		return ErrReferenceConflict
	}
	if res.MainPaise+res.BonusPaise != in.AmountPaise {
		return ErrReferenceConflict
	}
	w, err := s.repo.LockWallet(ctx, in.UserID)
	if err != nil {
		return err
	}
	res.Purchase = purchase
	res.Summary = formatWalletSummary(w)
	return nil
}

// bonusHalfOf finds the bonus part of a split purchase, if the purchase had one.
func (s *WalletServiceImpl) bonusHalfOf(ctx context.Context, purchase *WalletTransaction) (*WalletTransaction, error) {
	if purchase.TargetBalance != BalanceMain {
		return nil, nil
	}
	if _, split := purchase.Metadata[metaBonusPaise]; !split {
		return nil, nil
	}
	return s.repo.GetTransactionByReference(ctx, purchase.ReferenceID+":bonus")
}

func copyMeta(m map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(m)+1)
	for k, v := range m {
		out[k] = v
	}
	return out
}
