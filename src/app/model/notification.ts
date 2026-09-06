/** Mirrors backend NotificationType enum (pratik-dairy-user / enums/NotificationType.java). */
export type NotificationType = 'ORDER_UPDATE' | 'PAYMENT_UPDATE' | 'DELIVERY_REMINDER' | 'PROMOTION' | 'SYSTEM';

/** Mirrors backend NotificationDto (pratik-dairy-user / dto/NotificationDto.java). */
export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  read: boolean;
  referenceId?: string;
  createdAt: string;
}