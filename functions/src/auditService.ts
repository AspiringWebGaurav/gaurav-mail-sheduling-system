import * as admin from "firebase-admin";

const AUDIT_COL = "mailAuditLogs";

export interface MailAuditLog {
    action: string;
    status: string;
    reminderId: string;
    eventId: string;
    eventTitle?: string;
    userId: string;
    recipientEmail: string;
    recipientName?: string;
    provider?: string;
    templateId?: string;
    errorMessage?: string;
    durationMs?: number;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
    // timestamp added by server
}

/**
 * Logs mail actions to Firestore for audit trail visibility in admin dashboard.
 * Designed to be fire-and-forget but robust.
 */
export async function logMailAction(entry: MailAuditLog): Promise<void> {
    try {
        const db = admin.firestore();
        await db.collection(AUDIT_COL).add({
            ...entry,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            userAgent: "Cloud-Functions-Scheduler",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("🚨 AUDIT LOG FAILED:", error);
        // Do not throw - auditing should not crash the main flow
    }
}
