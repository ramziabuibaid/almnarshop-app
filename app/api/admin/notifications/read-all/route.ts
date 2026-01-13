import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '../../helpers';
import { markAllNotificationsAsRead } from '@/lib/notifications';

export async function POST(req: NextRequest) {
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

    await markAllNotificationsAsRead();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error marking all notifications as read:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
}
