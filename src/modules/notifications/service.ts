import { Notification, NotificationPreference, EscalationRule } from "../../common/types";
import { SetPreferencesInput, CreateEscalationRuleInput } from "./validators";
import { notImplemented } from "../../common/utils";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface WeeklyDigest {
  overdueCount: number;
  expiringThisWeek: number;
  pendingReviews: number;
  recentApprovals: number;
  generatedAt: Date;
}

export interface NotificationsService {
  getPreferences(userId: string): Promise<NotificationPreference[]>;
  setPreferences(userId: string, input: SetPreferencesInput): Promise<NotificationPreference[]>;
  listNotifications(userId: string, page?: number, limit?: number): Promise<PaginatedResult<Notification>>;
  markAsRead(id: string, userId: string): Promise<Notification>;
  dismiss(id: string, userId: string): Promise<void>;
  getWeeklyDigest(userId: string): Promise<WeeklyDigest>;
  sendTestNotification(userId: string): Promise<{ sent: boolean }>;
  createEscalationRule(input: CreateEscalationRuleInput): Promise<EscalationRule>;
  listEscalationRules(): Promise<EscalationRule[]>;
}

export const notificationsService: NotificationsService = {
  getPreferences: () => notImplemented("getPreferences"),
  setPreferences: () => notImplemented("setPreferences"),
  listNotifications: () => notImplemented("listNotifications"),
  markAsRead: () => notImplemented("markAsRead"),
  dismiss: () => notImplemented("dismiss"),
  getWeeklyDigest: () => notImplemented("getWeeklyDigest"),
  sendTestNotification: () => notImplemented("sendTestNotification"),
  createEscalationRule: () => notImplemented("createEscalationRule"),
  listEscalationRules: () => notImplemented("listEscalationRules"),
};
