import { Resend } from 'resend';

type ReservationBody = {
  restaurantName?: string;
  restaurantEmail?: string;
  guestEmail?: string;
  guestName?: string;
  date?: string;
  time?: string;
  people?: number;
  phone?: string;
  note?: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = (req.body || {}) as ReservationBody;
  if (!body.restaurantEmail || !body.guestEmail || !body.date || !body.time) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY || '');
  const from = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  await resend.emails.send({
    from,
    to: body.restaurantEmail,
    subject: `Neue Reservierung: ${body.date} ${body.time}`,
    text: [
      `Restaurant: ${body.restaurantName || '-'}`,
      `Datum: ${body.date}`,
      `Uhrzeit: ${body.time}`,
      `Name: ${body.guestName || '-'}`,
      `E-Mail: ${body.guestEmail}`,
      body.phone ? `Telefon: ${body.phone}` : null,
      body.people ? `Personen: ${body.people}` : null,
      body.note ? `Notiz: ${body.note}` : null
    ]
      .filter(Boolean)
      .join('\n')
  });

  await resend.emails.send({
    from,
    to: body.guestEmail,
    subject: `Ihre Reservierung bei ${body.restaurantName || 'dem Restaurant'}`,
    text: [
      `Danke für Ihre Reservierung!`,
      `Datum: ${body.date}`,
      `Uhrzeit: ${body.time}`,
      body.people ? `Personen: ${body.people}` : null
    ]
      .filter(Boolean)
      .join('\n')
  });

  res.status(200).json({ success: true });
}
