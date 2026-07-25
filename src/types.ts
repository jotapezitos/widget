export type UserRole = 'super_admin' | 'tenant_owner' | 'staff' | 'client';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  phone?: string;
  isSubscriber?: boolean;
  subscriptionPlan?: string;
  createdAt?: string;
  barberId?: string;
  photoUrl?: string;
}

export interface SaaSPlan {
  id: string;
  name: string;
  price: number; // Monthly price in BRL
  maxBarbers: number;
  maxServices: number;
  features: string[];
  popular?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  ownerUid: string;
  ownerName: string;
  ownerEmail: string;
  planId: string;
  planName: string;
  status: 'active' | 'blocked' | 'pending';
  mrr: number; // Monthly recurring revenue contribution
  createdAt: string;
  logoUrl?: string;
  phone?: string;
}

export interface Service {
  id: string;
  tenantId?: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  requirePrepayment?: boolean; // Prepagamento obrigatório ou no local
  icon: string;
  isFeatured?: boolean; // Highlighted in 1-Click quick booking box on Hero
  featuredTag?: string; // Tag for featured box (e.g., 'MAIS PEDIDO', 'ESPECIAL', 'COMPLETO')
}

export interface Barber {
  id: string;
  tenantId?: string;
  name: string;
  specialty: string;
  bio: string;
  photoUrl: string;
  phone: string;
  active: boolean;
  email?: string;
  googleEmail?: string;
  instagram?: string;
  isOwner?: boolean;
  rating?: number;
  experienceYears?: number;
  commissionRate?: number; // e.g. 70 meaning 70% for barber, 30% for house
}

export type AppointmentStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'delayed'
  | 'no_show'
  | 'cancelled'
  | 'reschedule_requested';

export interface Appointment {
  id: string;
  tenantId?: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  serviceDuration: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: AppointmentStatus;
  paymentType: 'online_pix' | 'online_card' | 'pay_at_location';
  paymentStatus: 'paid' | 'pending' | 'refunded';
  notes?: string;
  createdAt: string;
  requestedDate?: string;
  requestedTime?: string;
}

export type NotificationType =
  | 'booking'
  | 'reschedule_request'
  | 'reschedule_approved'
  | 'reschedule_rejected'
  | 'reschedule_by_staff'
  | 'reminder'
  | 'review_prompt'
  | 'retention';

export interface AppNotification {
  id: string;
  userId?: string;
  clientId?: string;
  targetRole?: UserRole | 'staff_or_owner' | 'barber';
  barberId?: string;
  title: string;
  message: string;
  type: NotificationType;
  appointmentId?: string;
  requestedDate?: string;
  requestedTime?: string;
  status?: 'pending' | 'approved' | 'rejected';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  recipientEmail?: string;
  recipientName?: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface ScheduleBreak {
  id: string;
  barberId: string;
  barberName: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  createdAt: string;
}

export interface StorySlide {
  id: string;
  image: string;
  title: string;
  barber: string;
  tag: string;
  time: string;
  isVideo?: boolean;
  ctaText?: string;
  ctaIcon?: 'calendar' | 'scissors' | 'sparkles' | 'flame' | 'zap';
}

export interface GallerySettings {
  username: string;
  avatarUrl: string;
  stories: StorySlide[];
}

export interface SupportTicketOption {
  label: string;
  action: 'node' | 'escalate' | 'resolve';
  nextNodeId?: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderRole: 'chatbot' | 'manager' | 'super_admin';
  senderName: string;
  senderEmail?: string;
  content: string;
  createdAt: string;
  options?: SupportTicketOption[];
}

export interface TicketFeedback {
  serviceRating: number; // 1 to 5 stars
  systemRating: number;  // 1 to 5 stars
  isResolved: boolean;    // true = Sim, false = Não
  comment?: string;       // nota/comentário adicional para o sistema
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  managerEmail: string;
  managerName: string;
  shopName: string;
  subject: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
  lastSenderRole: 'chatbot' | 'manager' | 'super_admin';
  unreadByAdmin: boolean;
  unreadByManager: boolean;
  feedback?: TicketFeedback;
}
