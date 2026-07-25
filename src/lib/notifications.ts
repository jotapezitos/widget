import { Appointment, AppNotification } from '../types';

export async function createInAppNotification(
  notification: Omit<AppNotification, 'id' | 'read' | 'createdAt'>
) {
  console.log('[Demo Mode] Notification created:', notification.title);
  return 'demo-notification-id';
}

export async function notifyNewBooking(apt: Appointment) {
  console.log('[Demo Mode] Notify new booking:', apt.id);
}

export async function notifyCompletedService(apt: Appointment) {
  console.log('[Demo Mode] Service completed:', apt.id);
}

export async function notifyStaffReschedule(
  appointmentId: string | Appointment,
  proposedDate: string,
  proposedTime: string,
  reason?: string
) {
  console.log('[Demo Mode] Staff reschedule:', { appointmentId, proposedDate, proposedTime, reason });
}

export async function requestReschedule(
  appointmentId: string | Appointment,
  proposedDate: string,
  proposedTime: string,
  requestedBy: 'client' | 'staff',
  reason?: string
) {
  console.log('[Demo Mode] Request reschedule:', { appointmentId, proposedDate, proposedTime, requestedBy, reason });
}

export async function requestClientReschedule(
  appointmentId: string | Appointment,
  proposedDate: string,
  proposedTime: string,
  reason?: string
) {
  return requestReschedule(appointmentId, proposedDate, proposedTime, 'client', reason);
}

export async function approveRescheduleRequest(notificationId: string | Appointment, appointmentId?: string) {
  console.log('[Demo Mode] Approve reschedule:', notificationId, appointmentId);
}

export async function rejectRescheduleRequest(
  notificationId: string | Appointment,
  appointmentId?: string,
  rejectionReason?: string
) {
  console.log('[Demo Mode] Reject reschedule:', notificationId, appointmentId, rejectionReason);
}

export async function notifyStatusChange(
  appointmentId: string,
  newStatus: 'confirmed' | 'cancelled' | 'completed'
) {
  console.log('[Demo Mode] Status change:', appointmentId, newStatus);
}

export async function checkAutomaticNotifications(..._args: any[]) {
  // Demo mode check
}
