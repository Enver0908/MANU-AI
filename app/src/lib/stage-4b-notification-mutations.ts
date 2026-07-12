import type {
  Stage4BNotificationMutationResponse,
  Stage4BNotificationReadAllResponse,
} from "./phase-85-stage-4b-contracts";

async function postNotificationMutation<T>(url: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`notification_mutation_failed_${response.status}`);
  }
  return (await response.json()) as T;
}

export function markStage4BNotificationRead(notificationId: string) {
  return postNotificationMutation<Stage4BNotificationMutationResponse>(`/api/notifications/${notificationId}/read`);
}

export function acknowledgeStage4BNotification(notificationId: string) {
  return postNotificationMutation<Stage4BNotificationMutationResponse>(
    `/api/notifications/${notificationId}/acknowledge`,
  );
}

export function markAllStage4BNotificationsRead() {
  return postNotificationMutation<Stage4BNotificationReadAllResponse>("/api/notifications/read-all");
}

export function completeStage4BUnsupportedMediaReview(notificationId: string) {
  return postNotificationMutation<Stage4BNotificationMutationResponse>(
    `/api/notifications/${notificationId}/complete-review`,
  );
}
