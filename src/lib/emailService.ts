export interface SendEmailOptions {
  toEmail: string;
  toName?: string;
  subject: string;
  title: string;
  bodyText: string;
  actionUrl?: string;
  actionText?: string;
  category?: 'notification' | 'support_ticket' | 'support_reply';
  relatedId?: string;
}

export const MASTER_ADMIN_EMAIL = 'jeanmarceloop@gmail.com';

export const sendEmailNotification = async (options: SendEmailOptions): Promise<boolean> => {
  console.log('[Demo Mode] Simulation Email Notification triggered:', options.subject);
  return true;
};
