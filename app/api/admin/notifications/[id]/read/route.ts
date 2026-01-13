import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/app/api/admin/helpers';
import { markNotificationAsRead } from '@/lib/notifications';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    // Check permission
    const canViewNotifications = admin.is_super_admin || 
      admin.permissions?.viewNotifications === true || 
      admin.permissions?.dashboardAndNotifications === true;
    if (!canViewNotifications) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Handle params as Promise (Next.js 15+) or object (Next.js 13-14)
    const resolvedParams = params instanceof Promise ? await params : params;
    const notificationId = resolvedParams.id;
    
    if (!notificationId) {
      return NextResponse.json({ message: 'Notification ID is required' }, { status: 400 });
    }

    console.log('[API] Marking notification as read:', notificationId);
    await markNotificationAsRead(notificationId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error marking notification as read:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
