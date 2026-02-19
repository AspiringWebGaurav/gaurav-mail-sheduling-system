import { adminDb } from '@/lib/server/admin';

export async function cleanupExpiredInvites() {
    try {
        const now = new Date();
        // Delete invites expired more than 24 hours ago
        // This gives a buffer for any "just expired" checks or user confusion
        const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Query for old expired docs
        // We limit to 50 to ensure this operation is fast and doesn't timeout
        const snapshot = await adminDb.collection('tokenInvites')
            .where('expiresAt', '<', cutoff)
            .limit(50)
            .get();

        if (snapshot.empty) return 0;

        const batch = adminDb.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`[Cleanup] Deleted ${snapshot.size} expired invites.`);

        return snapshot.size;
    } catch (error) {
        console.error('[Cleanup] Failed to cleanup expired invites:', error);
        return 0;
    }
}

export async function getExpiredInviteCount() {
    try {
        const now = new Date();
        const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const snapshot = await adminDb.collection('tokenInvites')
            .where('expiresAt', '<', cutoff)
            .count()
            .get();

        return snapshot.data().count;
    } catch (error) {
        console.error('[Cleanup] Failed to count expired invites:', error);
        return 0;
    }
}
