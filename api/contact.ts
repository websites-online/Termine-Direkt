type ContactBody = {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  plan?: string;
  location?: string;
  message?: string;
};

module.exports = async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, message: 'Use POST /api/contact' });
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

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromAddress = process.env.FROM_EMAIL;
    if (!fromAddress) {
      res.status(500).json({ error: 'Missing FROM_EMAIL' });
      return;
    }
    const from = fromAddress;
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

    const lines = [
      { label: 'Name', value: body.contactName },
      { label: 'E-Mail', value: body.email },
      { label: 'Telefon', value: body.phone },
      { label: 'Firma', value: body.companyName },
      { label: 'Standort', value: body.location },
      { label: 'Gewünschtes Paket', value: body.plan }
    ].filter((item) => item.value);

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;background:#f8fafc;padding:24px">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px">
          <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">Neue Anfrage über reserVino</h2>
          <p style="margin:0 0 16px;color:#475569">Eine neue Anfrage ist eingegangen.</p>
          <div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-top:12px">
            ${lines
              .map(
                (item) =>
                  `<div style="margin:6px 0"><strong style="display:inline-block;min-width:140px;color:#0f172a">${item.label}:</strong> <span style="color:#334155">${item.value}</span></div>`
              )
              .join('')}
          </div>
          <div style="margin-top:16px;padding:12px 14px;border-radius:12px;background:#f1f5f9;color:#0f172a">
            <strong>Nachricht</strong>
            <div style="margin-top:6px;color:#334155;white-space:pre-line">${body.message}</div>
          </div>
        </div>
      </div>
    `;

    await resend.emails.send({
      from,
      to: adminEmail,
      subject: 'Neue Anfrage von reserVino',
      replyTo: body.email,
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
        .join('\n'),
      html
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('contact api error', error);
    res.status(500).json({ error: 'Email send failed' });
  }
};
