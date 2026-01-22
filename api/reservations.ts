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

module.exports = async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, message: 'Use POST /api/reservations' });
    return;
  }

  try {
    const body = (req.body || {}) as ReservationBody;
    if (!body.restaurantEmail || !body.guestEmail || !body.date || !body.time) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      res.status(500).json({ error: 'Missing RESEND_API_KEY' });
      return;
    }

    console.log('reservation request', {
      restaurantEmail: body.restaurantEmail,
      guestEmail: body.guestEmail,
      date: body.date,
      time: body.time
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.FROM_EMAIL || 'onboarding@resend.dev';

    const details = [
      { label: 'Restaurant', value: body.restaurantName || '-' },
      { label: 'Datum', value: body.date },
      { label: 'Uhrzeit', value: body.time },
      { label: 'Name', value: body.guestName || '-' },
      { label: 'E-Mail', value: body.guestEmail },
      { label: 'Telefon', value: body.phone || '-' },
      { label: 'Personen', value: body.people ? String(body.people) : '-' },
      { label: 'Notiz', value: body.note || '-' }
    ];

    const restaurantHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;background:#f8fafc;padding:24px">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px">
          <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">Neue Reservierung</h2>
          <p style="margin:0 0 16px;color:#475569">Eine neue Reservierung ist eingegangen.</p>
          <div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-top:12px">
            ${details
              .map(
                (item) =>
                  `<div style="margin:6px 0"><strong style="display:inline-block;min-width:120px;color:#0f172a">${item.label}:</strong> <span style="color:#334155">${item.value}</span></div>`
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    const guestHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;background:#f8fafc;padding:24px">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px">
          <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">Reservierung bestätigt</h2>
          <p style="margin:0 0 16px;color:#475569">Danke für Ihre Reservierung${body.restaurantName ? ` bei ${body.restaurantName}` : ''}.</p>
          <div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-top:12px">
            <div style="margin:6px 0"><strong style="display:inline-block;min-width:120px;color:#0f172a">Datum:</strong> <span style="color:#334155">${body.date}</span></div>
            <div style="margin:6px 0"><strong style="display:inline-block;min-width:120px;color:#0f172a">Uhrzeit:</strong> <span style="color:#334155">${body.time}</span></div>
            ${body.people ? `<div style="margin:6px 0"><strong style="display:inline-block;min-width:120px;color:#0f172a">Personen:</strong> <span style="color:#334155">${body.people}</span></div>` : ''}
          </div>
          <p style="margin:16px 0 0;color:#475569">Wir freuen uns auf Ihren Besuch.</p>
        </div>
      </div>
    `;

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
        .join('\n'),
      html: restaurantHtml
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
        .join('\n'),
      html: guestHtml
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('reservations api error', error);
    res.status(500).json({ error: 'Email send failed' });
  }
};
