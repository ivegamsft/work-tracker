import { z } from "zod";

const notificationTypeSchema = z.enum([
  "overdue_requirement",
  "expiring_soon",
  "document_review_pending",
  "document_approved",
  "hour_conflict_flagged",
  "manual_hour_pending",
  "weekly_compliance_digest",
  "access_violation_alert",
]);
const deliveryChannelSchema = z.enum(["email", "in_app", "sms"]);
const notificationStatusSchema = z.enum(["sent", "read", "dismissed"]);
const frequencySchema = z.enum(["immediate", "daily", "weekly"]);
const escalationTriggerSchema = z.enum(["overdue_requirement", "expiring_soon", "conflict_pending"]);

export enum NotificationsErrorCode {
  NOTIFICATION_NOT_FOUND = "NOTIFICATION_NOT_FOUND",
  PREFERENCE_NOT_FOUND = "PREFERENCE_NOT_FOUND",
  ESCALATION_RULE_NOT_FOUND = "ESCALATION_RULE_NOT_FOUND",
  NOTIFICATION_FORBIDDEN = "NOTIFICATION_FORBIDDEN",
}

export const notificationsSetPreferencesRequestSchema = z.object({
  preferences: z.array(z.object({
    notificationType: notificationTypeSchema,
    channels: z.array(deliveryChannelSchema).min(1),
    isEnabled: z.boolean(),
    frequency: frequencySchema,
  })),
});

export const notificationsListQuerySchema = z.object({
  status: notificationStatusSchema.optional(),
  type: notificationTypeSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const notificationsCreateEscalationRuleRequestSchema = z.object({
  trigger: escalationTriggerSchema,
  delayHours: z.number().positive(),
  escalateToRole: z.string().min(1),
  maxEscalations: z.number().int().positive().max(5).default(3),
});

export const notificationsDeliveryResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string().min(1),
  message: z.string().min(1),
  actionUrl: z.string().nullable(),
  status: notificationStatusSchema,
  deliveryChannel: deliveryChannelSchema,
  createdAt: z.date(),
  readAt: z.date().nullable(),
});

export const notificationsPreferenceResponseSchema = z.object({
  id: z.string(),
  userId: z.string().uuid(),
  notificationType: notificationTypeSchema,
  channels: z.array(deliveryChannelSchema),
  isEnabled: z.boolean(),
  frequency: frequencySchema,
  updatedAt: z.date(),
});

export const notificationsEscalationRuleResponseSchema = z.object({
  id: z.string().uuid(),
  trigger: escalationTriggerSchema,
  delayHours: z.number().positive(),
  escalateToRole: z.string().min(1),
  maxEscalations: z.number().int().positive(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const notificationsListResponseSchema = z.object({
  data: z.array(notificationsDeliveryResponseSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

export const notificationsPreferenceListResponseSchema = z.array(notificationsPreferenceResponseSchema);
export const notificationsEscalationRuleListResponseSchema = z.array(notificationsEscalationRuleResponseSchema);

export const notificationsWeeklyDigestResponseSchema = z.object({
  overdueCount: z.number().int().nonnegative(),
  expiringThisWeek: z.number().int().nonnegative(),
  pendingReviews: z.number().int().nonnegative(),
  recentApprovals: z.number().int().nonnegative(),
  generatedAt: z.date(),
});

export const notificationsTestDeliveryResponseSchema = z.object({
  sent: z.boolean(),
});

export interface NotificationsSetPreferencesRequest extends z.infer<typeof notificationsSetPreferencesRequestSchema> {}
export interface NotificationsListQuery extends z.infer<typeof notificationsListQuerySchema> {}
export interface NotificationsCreateEscalationRuleRequest extends z.infer<typeof notificationsCreateEscalationRuleRequestSchema> {}
export interface NotificationsDeliveryResponse extends z.infer<typeof notificationsDeliveryResponseSchema> {}
export interface NotificationsPreferenceResponse extends z.infer<typeof notificationsPreferenceResponseSchema> {}
export interface NotificationsEscalationRuleResponse extends z.infer<typeof notificationsEscalationRuleResponseSchema> {}
export interface NotificationsListResponse extends z.infer<typeof notificationsListResponseSchema> {}
export interface NotificationsPreferenceListResponse extends z.infer<typeof notificationsPreferenceListResponseSchema> {}
export interface NotificationsEscalationRuleListResponse extends z.infer<typeof notificationsEscalationRuleListResponseSchema> {}
export interface NotificationsWeeklyDigestResponse extends z.infer<typeof notificationsWeeklyDigestResponseSchema> {}
export interface NotificationsTestDeliveryResponse extends z.infer<typeof notificationsTestDeliveryResponseSchema> {}
