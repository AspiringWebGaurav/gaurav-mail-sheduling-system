import 'server-only';
import { NextResponse } from 'next/server';
import { cleanupExpiredInvites, getExpiredInviteCount } from '@/lib/server/cleanup';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const deletedCount = await cleanupExpiredInvites();
        return NextResponse.json({ success: true, deleted: deletedCount });
    } catch (error) {
        console.error('Cleanup route error:', error);
        return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const count = await getExpiredInviteCount();
        return NextResponse.json({ count });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
