import type {
  NotificationsCreateEscalationRuleRequest,
  NotificationsSetPreferencesRequest,
} from "@e-clat/shared";
import { notificationsService } from "../../modules/notifications/service";
import type { INotificationRepository } from "../interfaces";

export class PrismaNotificationRepository {
  getPreferences(userId: string) {
    return notificationsService.getPreferences(userId);
  }

  setPreferences(userId: string, input: NotificationsSetPreferencesRequest) {
    return notificationsService.setPreferences(userId, input);
  }

  listNotifications(userId: string, page?: number, limit?: number) {
    return notificationsService.listNotifications(userId, page, limit);
  }

  markAsRead(id: string, userId: string) {
    return notificationsService.markAsRead(id, userId);
  }

  dismiss(id: string, userId: string) {
    return notificationsService.dismiss(id, userId);
  }

  getWeeklyDigest(userId: string) {
    return notificationsService.getWeeklyDigest(userId);
  }

  sendTestNotification(userId: string) {
    return notificationsService.sendTestNotification(userId);
  }

  createEscalationRule(input: NotificationsCreateEscalationRuleRequest) {
    return notificationsService.createEscalationRule(input);
  }

  listEscalationRules() {
    return notificationsService.listEscalationRules();
  }
}

export const prismaNotificationRepository = new PrismaNotificationRepository() as INotificationRepository;
