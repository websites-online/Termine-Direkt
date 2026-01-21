import { Resend } from 'resend';

type ContactBody = {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  plan?: string;
  location?: string;
  message?: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = (req.body || {}) as ContactBody;
    if (!body.contactName || !body.email || !body.message) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      res.status(500).json({ error: 'Missing RESEND_API_KEY' });
      return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

    await resend.emails.send({
      from,
      to: adminEmail,
      subject: 'Neue Anfrage von termine-direkt',
      text: [
        `Name: ${body.contactName}`,
        `E-Mail: ${body.email}`,
        body.phone ? `Telefon: ${body.phone}` : null,
        body.companyName ? `Firma: ${body.companyName}` : null,
        body.location ? `Standort: ${body.location}` : null,
        body.plan ? `Gewünschtes Paket: ${body.plan}` : null,
        '',
        body.message
      ]
        .filter(Boolean)
        .join('\n')
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('contact api error', error);
    res.status(500).json({ error: 'Email send failed' });
  }
}
