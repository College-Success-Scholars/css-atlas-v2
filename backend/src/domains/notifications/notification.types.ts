// notification.types.ts
export const NotificationEventType = {
    MISSED_STUDY_SESSION: 'missed_study_session',
    MISSED_FRONT_DESK: 'missed_front_desk',
} as const;
export type NotificationEventType = typeof NotificationEventType[keyof typeof NotificationEventType];