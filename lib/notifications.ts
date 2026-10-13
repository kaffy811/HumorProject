import { profileRequest } from "./profiles";
import type {
  NotificationPage,
  NotificationSummary,
} from "./notification-contracts";
export function getUnreadNotifications() {
  return profileRequest<NotificationSummary>("/api/notifications/summary");
}
export function listNotifications(cursor?: string | null) {
  return profileRequest<NotificationPage>(
    `/api/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
}
export function openNotifications() {
  return profileRequest<NotificationPage>("/api/notifications", {
    method: "POST",
  });
}
