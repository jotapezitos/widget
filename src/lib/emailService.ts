import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

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

// Default Master Admin email reference if needed dynamically
export const MASTER_ADMIN_EMAIL = 'jeanmarceloop@gmail.com';

/**
 * Automates email dispatch for all in-app notifications and support tickets.
 * Generates email content, logs the dispatch to Firestore ('email_outbox'),
 * and dispatches request to transactional email service (/api/send-email).
 */
export const sendEmailNotification = async (options: SendEmailOptions): Promise<boolean> => {
  try {
    const {
      toEmail,
      toName = 'Usuário',
      subject,
      title,
      bodyText,
      actionUrl = typeof window !== 'undefined' ? window.location.origin : 'https://barber.app',
      actionText = 'Acessar o Sistema',
      category = 'notification',
      relatedId,
    } = options;

    if (!toEmail || !toEmail.includes('@')) {
      console.warn('sendEmailNotification: E-mail de destino inválido ou omitido:', toEmail);
      return false;
    }

    const cleanSubject = subject.replace(/\s+/g, ' ').trim();
    const cleanBody = bodyText.replace(/\s+/g, ' ').trim();
    const sentAt = new Date().toISOString();

    // 1. Generate clean HTML email layout template
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; color: #18181b; }
            .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 2px solid #000000; box-shadow: 4px 4px 0px 0px #000000; overflow: hidden; }
            .header { background: #f59e0b; padding: 24px; text-align: center; border-bottom: 2px solid #000000; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: #000000; }
            .content { padding: 28px; }
            .title { font-size: 18px; font-weight: 700; color: #000000; margin-top: 0; margin-bottom: 12px; }
            .message { font-size: 14px; line-height: 1.6; color: #3f3f46; margin-bottom: 24px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 16px; }
            .button { display: inline-block; background: #f59e0b; color: #000000; font-weight: 800; font-size: 14px; text-transform: uppercase; text-decoration: none; padding: 14px 28px; border-radius: 12px; border: 2px solid #000000; box-shadow: 3px 3px 0px 0px #000000; }
            .footer { background: #fafafa; padding: 16px; text-align: center; font-size: 11px; color: #a1a1aa; border-top: 1px solid #e4e4e7; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>✂️ Barba & Estilo SaaS</h1>
            </div>
            <div class="content">
              <div class="title">Olá, ${toName}!</div>
              <div class="message">
                <strong>${title}</strong><br><br>
                ${cleanBody}
              </div>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${actionUrl}" class="button" target="_blank">${actionText}</a>
              </div>
            </div>
            <div class="footer">
              Você recebeu este e-mail por estar cadastrado no sistema Barba & Estilo.<br>
              Link de acesso direto: ${actionUrl}
            </div>
          </div>
        </body>
      </html>
    `;

    // 2. Post to /api/send-email route
    try {
      const apiResponse = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail,
          toName,
          subject: cleanSubject,
          title,
          bodyText: cleanBody,
          htmlBody,
          actionUrl,
          actionText,
          category,
          relatedId,
        }),
      });
      const apiResult = await apiResponse.json();
      console.log(`[API Transactional Email Dispatch] Status:`, apiResult);
    } catch (apiError) {
      console.warn('Could not connect to /api/send-email route:', apiError);
    }

    // 3. Persist email log to Firestore collection 'email_outbox'
    await addDoc(collection(db, 'email_outbox'), {
      toEmail,
      toName,
      subject: cleanSubject,
      title,
      bodyText: cleanBody,
      htmlBody,
      actionUrl,
      actionText,
      category,
      relatedId: relatedId || null,
      status: 'sent',
      sentAt,
    });

    console.log(`[E-mail Registrado] 📧 Para: ${toEmail} | Assunto: ${cleanSubject}`);

    return true;
  } catch (error) {
    console.error('Error in sendEmailNotification:', error);
    handleFirestoreError(error, OperationType.CREATE, 'email_outbox');
    return false;
  }
};
