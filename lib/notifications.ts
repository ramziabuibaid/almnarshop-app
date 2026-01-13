import { supabase } from './supabase';

export type NotificationType = 'create' | 'update' | 'delete';

/**
 * Helper function to get customer name from customer ID
 */
export async function getCustomerName(customerId: string | null | undefined): Promise<string> {
  if (!customerId) return 'غير محدد';
  
  try {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('name')
      .eq('customer_id', customerId)
      .single();
    
    if (error || !customer) {
      return 'غير محدد';
    }
    
    return customer.name || 'غير محدد';
  } catch (error) {
    console.error('[Notifications] Failed to get customer name:', error);
    return 'غير محدد';
  }
}

export interface NotificationData {
  type: NotificationType;
  table_name: string;
  record_name: string;
  message: string;
  user_name: string;
}

/**
 * Create a notification in the system_notifications table
 * This function is called after successful write operations to track employee actions
 */
export async function createNotification(data: NotificationData): Promise<void> {
  try {
    const { error } = await supabase
      .from('system_notifications')
      .insert({
        type: data.type,
        table_name: data.table_name,
        record_name: data.record_name,
        message: data.message,
        user_name: data.user_name,
        is_read: false,
      });

    if (error) {
      console.error('[Notifications] Failed to create notification:', error);
      // Don't throw - notifications are non-critical, we don't want to break the main operation
    } else {
      console.log('[Notifications] Notification created:', data.message);
    }
  } catch (error: any) {
    console.error('[Notifications] Error creating notification:', error);
    // Don't throw - notifications are non-critical
  }
}

/**
 * Get all notifications (for dashboard)
 */
export async function getNotifications(filters?: {
  user_name?: string;
  type?: NotificationType;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<any[]> {
  try {
    let query = supabase
      .from('system_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.user_name) {
      query = query.eq('user_name', filters.user_name);
    }

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Notifications] Failed to fetch notifications:', error);
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('[Notifications] Error fetching notifications:', error);
    throw error;
  }
}

/**
 * Get unread notifications count
 */
export async function getUnreadNotificationsCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('system_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    if (error) {
      console.error('[Notifications] Failed to get unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error: any) {
    console.error('[Notifications] Error getting unread count:', error);
    return 0;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('system_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('[Notifications] Failed to mark notification as read:', error);
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  } catch (error: any) {
    console.error('[Notifications] Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  try {
    const { error } = await supabase
      .from('system_notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) {
      console.error('[Notifications] Failed to mark all as read:', error);
      throw new Error(`Failed to mark all as read: ${error.message}`);
    }
  } catch (error: any) {
    console.error('[Notifications] Error marking all as read:', error);
    throw error;
  }
}
