export const LATENCY_THRESHOLD_MS = 80;
export const TEMPERATURE_THRESHOLD_C = 70;
export const OFFLINE_WINDOW_MINUTES = 15;

export const EQUIPMENT_STATUS = ["online", "offline", "warning", "maintenance"] as const;
export const SUBSCRIBER_STATUS = ["active", "suspended", "pending"] as const;
export const ALARM_SEVERITY = ["critical", "high", "medium", "low"] as const;
