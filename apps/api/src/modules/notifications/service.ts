import {
  type Notification,
  type NotificationPreference,
  type EscalationRule,
  type NotificationType,
  type DeliveryChannel,
  type NotificationFrequency,
  NotFoundError,
} from "@e-clat/shared";
import {
  NotificationStatus as PrismaNotificationStatus,
  type Prisma,
  QualificationStatus,
  DocumentStatus,
  ReviewStatus,
} from "@prisma/client";
import { SetPreferencesInput, CreateEscalationRuleInput } from "./validators";
import { prisma } from "../../config/database";

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

const notificationSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  message: true,
  actionUrl: true,
  status: true,
  deliveryChannel: true,
  createdAt: true,
  readAt: true,
} satisfies Prisma.NotificationSelect;

const notificationPreferenceSelect = {
  id: true,
  userId: true,
  notificationType: true,
  channels: true,
  isEnabled: true,
  frequency: true,
  updatedAt: true,
} satisfies Prisma.NotificationPreferenceSelect;

const escalationRuleSelect = {
  id: true,
  trigger: true,
  delayHours: true,
  escalateToRole: true,
  maxEscalations: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EscalationRuleSelect;

type NotificationRecord = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;
type NotificationPreferenceRecord = Prisma.NotificationPreferenceGetPayload<{
  select: typeof notificationPreferenceSelect;
}>;
type EscalationRuleRecord = Prisma.EscalationRuleGetPayload<{ select: typeof escalationRuleSelect }>;

function fromPrismaNotificationStatus(status: PrismaNotificationStatus): Notification["status"] {
  switch (status) {
    case PrismaNotificationStatus.SENT:
      return "sent";
    case PrismaNotificationStatus.READ:
      return "read";
    case PrismaNotificationStatus.DISMISSED:
      return "dismissed";
  }
}

function mapNotification(record: NotificationRecord): Notification {
  return {
    id: record.id,
    userId: record.userId,
    type: record.type as NotificationType,
    title: record.title,
    message: record.message,
    actionUrl: record.actionUrl,
    status: fromPrismaNotificationStatus(record.status),
    deliveryChannel: record.deliveryChannel as DeliveryChannel,
    createdAt: record.createdAt,
    readAt: record.readAt,
  };
}

function mapNotificationPreference(record: NotificationPreferenceRecord): NotificationPreference {
  return {
    id: record.id,
    userId: record.userId,
    notificationType: record.notificationType as NotificationType,
    channels: record.channels as DeliveryChannel[],
    isEnabled: record.isEnabled,
    frequency: record.frequency as NotificationFrequency,
    updatedAt: record.updatedAt,
  };
}

function mapEscalationRule(record: EscalationRuleRecord): EscalationRule {
  return {
    id: record.id,
    trigger: record.trigger as EscalationRule["trigger"],
    delayHours: record.delayHours,
    escalateToRole: record.escalateToRole,
    maxEscalations: record.maxEscalations,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

const DEFAULT_NOTIFICATION_TYPES: NotificationType[] = [
  "overdue_requirement",
  "expiring_soon",
  "document_review_pending",
  "document_approved",
  "hour_conflict_flagged",
  "manual_hour_pending",
  "weekly_compliance_digest",
  "access_violation_alert",
];

function getDefaultPreferences(userId: string): NotificationPreference[] {
  return DEFAULT_NOTIFICATION_TYPES.map((type) => ({
    id: "",
    userId,
    notificationType: type,
    channels: ["in_app" as DeliveryChannel],
    isEnabled: true,
    frequency: "immediate" as NotificationFrequency,
    updatedAt: new Date(),
  }));
}

export const notificationsService: NotificationsService = {
  async getPreferences(userId) {
    const preferences = await prisma.notificationPreference.findMany({
      where: { userId },
      select: notificationPreferenceSelect,
    });

    if (preferences.length === 0) {
      return getDefaultPreferences(userId);
    }

    return preferences.map(mapNotificationPreference);
  },

  async setPreferences(userId, input) {
    for (const pref of input.preferences) {
      await prisma.notificationPreference.upsert({
        where: {
          userId_notificationType: {
            userId,
            notificationType: pref.notificationType,
          },
        },
        create: {
          userId,
          notificationType: pref.notificationType,
          channels: pref.channels,
          isEnabled: pref.isEnabled,
          frequency: pref.frequency,
        },
        update: {
          channels: pref.channels,
          isEnabled: pref.isEnabled,
          frequency: pref.frequency,
        },
      });
    }

    const allPreferences = await prisma.notificationPreference.findMany({
      where: { userId },
      select: notificationPreferenceSelect,
    });

    return allPreferences.map(mapNotificationPreference);
  },

  async listNotifications(userId, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: notificationSelect,
      }),
      prisma.notification.count({
        where: { userId },
      }),
    ]);

    return {
      data: notifications.map(mapNotification),
      total,
      page,
      limit,
    };
  },

  async markAsRead(id, userId) {
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundError("Notification", id);
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        status: PrismaNotificationStatus.READ,
        readAt: new Date(),
      },
      select: notificationSelect,
    });

    return mapNotification(updated);
  },

  async dismiss(id, userId) {
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundError("Notification", id);
    }

    await prisma.notification.update({
      where: { id },
      data: {
        status: PrismaNotificationStatus.DISMISSED,
      },
    });
  },

  async getWeeklyDigest(userId) {
    const employee = await prisma.employee.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundError("Employee", userId);
    }

    const today = new Date();
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [overdueCount, expiringThisWeek, pendingReviews, recentApprovals] = await Promise.all([
      prisma.qualification.count({
        where: {
          employeeId: userId,
          status: QualificationStatus.EXPIRED,
        },
      }),
      prisma.qualification.count({
        where: {
          employeeId: userId,
          status: { not: QualificationStatus.EXPIRED },
          expirationDate: {
            gte: today,
            lte: sevenDaysFromNow,
          },
        },
      }),
      prisma.reviewQueueItem.count({
        where: {
          status: ReviewStatus.PENDING,
        },
      }),
      prisma.document.count({
        where: {
          employeeId: userId,
          status: DocumentStatus.APPROVED,
          updatedAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
    ]);

    return {
      overdueCount,
      expiringThisWeek,
      pendingReviews,
      recentApprovals,
      generatedAt: new Date(),
    };
  },

  async sendTestNotification(userId) {
    await prisma.notification.create({
      data: {
        userId,
        type: "access_violation_alert",
        title: "Test Notification",
        message: "This is a test notification",
        deliveryChannel: "in_app",
        status: PrismaNotificationStatus.SENT,
      },
    });

    return { sent: true };
  },

  async createEscalationRule(input) {
    const rule = await prisma.escalationRule.create({
      data: {
        trigger: input.trigger,
        delayHours: input.delayHours,
        escalateToRole: input.escalateToRole,
        maxEscalations: input.maxEscalations,
      },
      select: escalationRuleSelect,
    });

    return mapEscalationRule(rule);
  },

  async listEscalationRules() {
    const rules = await prisma.escalationRule.findMany({
      orderBy: { createdAt: "desc" },
      select: escalationRuleSelect,
    });

    return rules.map(mapEscalationRule);
  },
};
