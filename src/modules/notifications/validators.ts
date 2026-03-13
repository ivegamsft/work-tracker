import { z } from "zod";

const notificationTypeEnum = z.enum([
  "overdue_requirement",
  "expiring_soon",
  "document_review_pending",
  "document_approved",
  "hour_conflict_flagged",
  "manual_hour_pending",
  "weekly_compliance_digest",
  "access_violation_alert",
]);

const deliveryChannelEnum = z.enum(["email", "in_app", "sms"]);
const frequencyEnum = z.enum(["immediate", "daily", "weekly"]);

export const setPreferencesSchema = z.object({
  preferences: z.array(z.object({
    notificationType: notificationTypeEnum,
    channels: z.array(deliveryChannelEnum).min(1),
    isEnabled: z.boolean(),
    frequency: frequencyEnum,
  })),
});

export const notificationQuerySchema = z.object({
  status: z.enum(["sent", "read", "dismissed"]).optional(),
  type: notificationTypeEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const createEscalationRuleSchema = z.object({
  trigger: z.enum(["overdue_requirement", "expiring_soon", "conflict_pending"]),
  delayHours: z.number().positive(),
  escalateToRole: z.string().min(1),
  maxEscalations: z.number().int().positive().max(5).default(3),
});

export type SetPreferencesInput = z.infer<typeof setPreferencesSchema>;
export type CreateEscalationRuleInput = z.infer<typeof createEscalationRuleSchema>;
