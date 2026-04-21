/**
 * Base response interface for notification services.
 */
export interface NotificationResponse {
  success: boolean;
  messageId?: string;
  cost?: number | string;
  error?: string;
}

/**
 * Combined response for multi-channel notifications.
 */
export interface MultiChannelNotificationResponse {
  email?: NotificationResponse | null;
  sms?: NotificationResponse | null;
  success?: boolean;
  error?: string;
}
