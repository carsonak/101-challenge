/** Shared expiry-at-read and physical cleanup policy for owner inbox notices. */
export const notificationRetention = {
  acknowledgedDays: 30,
  unreadDays: 90,
} as const;
