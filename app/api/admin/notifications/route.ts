import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '../helpers';
import { getNotifications, getUnreadNotificationsCount } from '@/lib/notifications';

export async function GET(req: NextRequest) {
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

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const user_name = searchParams.get('user_name') || undefined;
    const type = searchParams.get('type') as 'create' | 'update' | 'delete' | undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const notifications = await getNotifications({
      user_name,
      type,
      startDate,
      endDate,
      limit,
    });

    const unreadCount = await getUnreadNotificationsCount();

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error('[API] Error fetching notifications:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
