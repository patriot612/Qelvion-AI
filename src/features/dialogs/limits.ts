export interface DialogLimits { activeLimit: number; archivedLimit: number; messagesPerDialog: number; archiveTtlHours: number; }
export const DEFAULT_FREE_DIALOG_LIMITS: DialogLimits = { activeLimit: 5, archivedLimit: 15, messagesPerDialog: 50, archiveTtlHours: 24 };
