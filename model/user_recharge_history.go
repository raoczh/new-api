package model

import (
	"cmp"
	"context"
	"slices"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
)

// Quota values are decimal strings so history totals cannot overflow an integer
// or lose precision during JSON transport. They are not payment-currency amounts.
type UserRechargeRecord struct {
	ID            string  `json:"id"`
	Source        string  `json:"source"`
	CreatedAt     int64   `json:"created_at"`
	Status        string  `json:"status"`
	Quota         *string `json:"quota"`
	Reference     string  `json:"reference"`
	PaymentMethod string  `json:"payment_method,omitempty"`
	Operator      string  `json:"operator,omitempty"`
	Action        string  `json:"action,omitempty"`
	Before        *int64  `json:"before,omitempty"`
	After         *int64  `json:"after,omitempty"`
}

type UserRechargeSummary struct {
	CreditedQuota string `json:"credited_quota"`
	DebitedQuota  string `json:"debited_quota"`
	NetQuota      string `json:"net_quota"`
	UnknownCount  int    `json:"unknown_count"`
}

type UserRechargeHistory struct {
	Items    []UserRechargeRecord `json:"items"`
	Total    int                  `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"page_size"`
	Summary  UserRechargeSummary  `json:"summary"`
}

func GetUserRechargeHistory(ctx context.Context, userID int, pageInfo *common.PageInfo) (*UserRechargeHistory, error) {
	if userID <= 0 || pageInfo.Page < 1 || pageInfo.PageSize < 1 || pageInfo.PageSize > 100 {
		return nil, common.NewMessage("Invalid parameters")
	}

	records := make([]UserRechargeRecord, 0)
	var topUps []TopUp
	// Subscription purchases also write top_ups, but have Amount == 0 and
	// never credit the wallet. Do not count them as recharges.
	if err := DB.WithContext(ctx).Where("user_id = ? AND amount > 0", userID).Find(&topUps).Error; err != nil {
		return nil, err
	}
	for _, topUp := range topUps {
		quota := decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
		provider := topUp.PaymentProvider
		if provider == "" {
			provider = topUp.PaymentMethod
		}
		switch provider {
		case PaymentProviderStripe:
			quota = decimal.NewFromFloat(topUp.Money).Mul(decimal.NewFromFloat(common.QuotaPerUnit))
		case PaymentProviderCreem:
			quota = decimal.NewFromInt(topUp.Amount)
		}
		quotaText := quota.Truncate(0).String()
		createdAt := topUp.CreateTime
		if topUp.CompleteTime > 0 {
			createdAt = topUp.CompleteTime
		}
		records = append(records, UserRechargeRecord{
			ID: "topup-" + strconv.Itoa(topUp.Id), Source: "online", CreatedAt: createdAt,
			Status: topUp.Status, Quota: &quotaText, Reference: topUp.TradeNo, PaymentMethod: topUp.PaymentMethod,
		})
	}

	var redemptions []Redemption
	// A soft-deleted code still represents an actual past wallet credit. Never
	// select its secret key; the history only exposes the record ID and name.
	if err := DB.WithContext(ctx).Unscoped().Select("id", "name", "quota", "redeemed_time").
		Where("used_user_id = ? AND status = ?", userID, common.RedemptionCodeStatusUsed).
		Find(&redemptions).Error; err != nil {
		return nil, err
	}
	for _, redemption := range redemptions {
		quotaText := strconv.Itoa(redemption.Quota)
		records = append(records, UserRechargeRecord{
			ID: "redemption-" + strconv.Itoa(redemption.Id), Source: "redemption", CreatedAt: redemption.RedeemedTime,
			Status: common.TopUpStatusSuccess, Quota: &quotaText, Reference: redemption.Name,
		})
	}

	var logs []Log
	if err := LOG_DB.WithContext(ctx).Select("id", "created_at", "request_id", "other").
		Where("user_id = ? AND type = ?", userID, LogTypeTopup).Find(&logs).Error; err != nil {
		return nil, err
	}
	for _, entry := range logs {
		var metadata struct {
			Op *struct {
				Action string `json:"action"`
				Params struct {
					From  *int64 `json:"from"`
					To    *int64 `json:"to"`
					Quota *int64 `json:"quota"`
				} `json:"params"`
			} `json:"op"`
			AdminInfo *AuditAdminInfo `json:"admin_info"`
		}
		if common.UnmarshalJsonStr(entry.Other, &metadata) != nil || metadata.Op == nil {
			continue
		}
		action := metadata.Op.Action
		if action != "user.quota_add" && action != "user.quota_subtract" && action != "user.quota_override" {
			continue
		}
		record := UserRechargeRecord{
			ID:     "manual-" + strconv.Itoa(entry.Id) + "-" + entry.RequestId,
			Source: "manual", CreatedAt: entry.CreatedAt, Status: common.TopUpStatusSuccess,
			Action: action, Before: metadata.Op.Params.From, After: metadata.Op.Params.To,
		}
		if metadata.AdminInfo != nil {
			record.Operator = metadata.AdminInfo.AdminUsername
		}
		var quota *decimal.Decimal
		if record.Before != nil && record.After != nil {
			difference := decimal.NewFromInt(*record.After).Sub(decimal.NewFromInt(*record.Before))
			quota = &difference
		} else if metadata.Op.Params.Quota != nil && action != "user.quota_override" {
			difference := decimal.NewFromInt(*metadata.Op.Params.Quota).Abs()
			if action == "user.quota_subtract" {
				difference = difference.Neg()
			}
			quota = &difference
		}
		if quota != nil {
			quotaText := quota.String()
			record.Quota = &quotaText
		}
		// Online and redemption logs are intentionally not merged: their source
		// records above already account for the credit, including completed orders.
		records = append(records, record)
	}

	credited, debited := decimal.Zero, decimal.Zero
	unknownCount := 0
	for _, record := range records {
		if record.Status != common.TopUpStatusSuccess {
			continue
		}
		if record.Quota == nil {
			unknownCount++
			continue
		}
		quota, err := decimal.NewFromString(*record.Quota)
		if err != nil {
			return nil, err
		}
		if quota.IsNegative() {
			debited = debited.Sub(quota)
		} else {
			credited = credited.Add(quota)
		}
	}
	slices.SortFunc(records, func(first, second UserRechargeRecord) int {
		if order := cmp.Compare(second.CreatedAt, first.CreatedAt); order != 0 {
			return order
		}
		return cmp.Compare(second.ID, first.ID)
	})
	start := len(records)
	// Check before multiplying so an arbitrarily large requested page cannot overflow.
	if pageInfo.Page-1 <= len(records)/pageInfo.PageSize {
		start = (pageInfo.Page - 1) * pageInfo.PageSize
	}
	end := start + min(pageInfo.PageSize, len(records)-start)
	return &UserRechargeHistory{
		Items: records[start:end], Total: len(records), Page: pageInfo.Page, PageSize: pageInfo.PageSize,
		Summary: UserRechargeSummary{
			CreditedQuota: credited.String(), DebitedQuota: debited.String(),
			NetQuota: credited.Sub(debited).String(), UnknownCount: unknownCount,
		},
	}, nil
}
