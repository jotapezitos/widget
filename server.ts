import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Transactional Email Dispatcher
  app.post('/api/send-email', async (req, res) => {
    try {
      const { toEmail, toName, subject, htmlBody, bodyText, category, relatedId } = req.body;

      if (!toEmail || typeof toEmail !== 'string' || !toEmail.includes('@')) {
        return res.status(400).json({ error: 'Valid destination toEmail is required.' });
      }

      const resendApiKey = process.env.RESEND_API_KEY || process.env.EMAIL_SERVICE_API_KEY;
      const emailWebhookUrl = process.env.EMAIL_WEBHOOK_URL;
      const fromEmail = process.env.EMAIL_FROM || 'Barba & Estilo <notificacoes@barbaestilo.com.br>';

      console.log(`[API Send Email] Transact Dispatch -> To: ${toEmail} | Subject: "${subject}"`);

      // 1. Transactional Provider: Resend API
      if (resendApiKey) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [toEmail],
            subject: subject,
            html: htmlBody,
            text: bodyText,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          console.log(`[Resend Success] Email delivered to ${toEmail}:`, data);
          return res.json({ success: true, provider: 'resend', id: data.id });
        } else {
          console.error(`[Resend Error] Failed to deliver to ${toEmail}:`, data);
          return res.status(500).json({ error: 'Resend API Error', details: data });
        }
      }

      // 2. Webhook / Custom Transactional Email Relay
      if (emailWebhookUrl) {
        const response = await fetch(emailWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail,
            toName,
            subject,
            htmlBody,
            bodyText,
            category,
            relatedId,
            sentAt: new Date().toISOString(),
          }),
        });

        if (response.ok) {
          console.log(`[Webhook Success] Email dispatched to webhook for ${toEmail}`);
          return res.json({ success: true, provider: 'webhook' });
        }
      }

      // 3. Fallback server log when no external key configured yet
      console.log(`[Email Service Ready] Transact email processed for ${toEmail}. Set RESEND_API_KEY in environment variables to route live emails.`);
      return res.json({
        success: true,
        provider: 'server_logger',
        delivered: false,
        message: 'Email service route active. Add RESEND_API_KEY or EMAIL_WEBHOOK_URL to environment variables for live SMTP/API delivery.',
      });
    } catch (err: any) {
      console.error('[API Send Email Error]:', err);
      return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // Vite middleware for development vs static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
