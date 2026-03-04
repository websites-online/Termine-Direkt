type ReservationBody = {
  restaurantName?: string;
  restaurantSlug?: string;
  restaurantEmail?: string;
  serviceType?: 'restaurant' | 'friseur';
  service?: string;
  guestEmail?: string;
  guestName?: string;
  date?: string;
  time?: string;
  people?: number;
  phone?: string;
  note?: string;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderRows = (rows: Array<{ label: string; value: string }>): string =>
  rows
    .map(
      (row) => `
      <tr>
        <td style="padding:8px 0;color:#64748b;font-size:14px;vertical-align:top">${escapeHtml(row.label)}</td>
        <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;vertical-align:top">${escapeHtml(
          row.value
        )}</td>
      </tr>
    `
    )
    .join('');

const platformUrl =
  process.env.PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  'https://nextime-booking.de';

const getTimeBasedGreeting = (): string => {
  try {
    const hourText = new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Europe/Berlin'
    }).format(new Date());
    const hour = Number.parseInt(hourText, 10);

    if (!Number.isNaN(hour) && hour >= 5 && hour < 11) {
      return 'Guten Morgen';
    }
    if (!Number.isNaN(hour) && hour >= 11 && hour < 18) {
      return 'Guten Tag';
    }
    return 'Guten Abend';
  } catch {
    return 'Guten Tag';
  }
};

const buildEmailLayout = ({
  brand,
  title,
  intro,
  rows,
  footer,
  footerLink,
  footerLinkLabel
}: {
  brand: string;
  title: string;
  intro: string;
  rows: Array<{ label: string; value: string }>;
  footer: string;
  footerLink?: string;
  footerLinkLabel?: string;
}): string => `
  <div style="margin:0;padding:0;background:#f1f5f9">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
            <tr>
              <td style="background:linear-gradient(90deg,#4338ca,#4f46e5);padding:18px 24px">
                <div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700">${escapeHtml(
                  brand
                )}</div>
                <div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:24px;font-weight:700;margin-top:4px">${escapeHtml(
                  title
                )}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:15px;line-height:1.5">
                ${escapeHtml(intro)}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 24px 8px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0">
                  ${renderRows(rows)}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px 24px;font-family:Arial,Helvetica,sans-serif;color:#64748b;font-size:13px;line-height:1.5">
                <div style="white-space:pre-line">${escapeHtml(footer)}</div>
                ${
                  footerLink
                    ? `<div style="margin-top:16px;text-align:center"><a href="${escapeHtml(
                        footerLink
                      )}" style="color:#4338ca;text-decoration:none;font-weight:700">${escapeHtml(
                        footerLinkLabel || footerLink
                      )}</a></div>`
                    : ''
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`;

const getClient = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE key');
  }
  return createClient(url, key);
};

module.exports = async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const restaurantSlug = typeof req.query?.restaurantSlug === 'string' ? req.query.restaurantSlug : '';
      const date = typeof req.query?.date === 'string' ? req.query.date : '';
      if (!restaurantSlug || !date) {
        res.status(200).json({ slots: {} });
        return;
      }
      const supabase = getClient();
      const { data, error } = await supabase
        .from('reservations')
        .select('time')
        .eq('restaurant_slug', restaurantSlug)
        .eq('date', date);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      const counts: Record<string, number> = {};
      (data || []).forEach((row: { time: string }) => {
        counts[row.time] = (counts[row.time] || 0) + 1;
      });
      res.status(200).json({ slots: counts });
      return;
    } catch (error: any) {
      console.error('reservations api error', error);
      res.status(500).json({ error: error.message || 'Server error' });
      return;
    }
  }

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

    if (!body.restaurantSlug) {
      res.status(400).json({ error: 'Missing restaurant slug' });
      return;
    }

    const supabase = getClient();
    const { data: company } = await supabase
      .from('companies')
      .select('slot_capacity')
      .eq('slug', body.restaurantSlug)
      .maybeSingle();
    const slotCapacity = typeof company?.slot_capacity === 'number' ? company.slot_capacity : 3;

    const { count, error: countError } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_slug', body.restaurantSlug)
      .eq('date', body.date)
      .eq('time', body.time);
    if (countError) {
      res.status(500).json({ error: countError.message });
      return;
    }
    if ((count || 0) >= slotCapacity) {
      res.status(409).json({ error: 'Slot voll' });
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
    const fromAddress = process.env.FROM_EMAIL;
    if (!fromAddress) {
      res.status(500).json({ error: 'Missing FROM_EMAIL' });
      return;
    }
    const fromName = body.restaurantName ? body.restaurantName.trim() : '';
    const from = fromName ? `${fromName} <${fromAddress}>` : `Reservierungsservice <${fromAddress}>`;

    const noteParts = [
      body.service ? `Service: ${body.service}` : null,
      body.note ? `Notiz: ${body.note}` : null
    ].filter(Boolean);

    const { error: insertError } = await supabase.from('reservations').insert({
      restaurant_slug: body.restaurantSlug,
      restaurant_name: body.restaurantName || null,
      restaurant_email: body.restaurantEmail,
      guest_name: body.guestName || null,
      guest_email: body.guestEmail,
      phone: body.phone || null,
      people: body.people || null,
      note: noteParts.length > 0 ? noteParts.join(' | ') : null,
      date: body.date,
      time: body.time
    });
    if (insertError) {
      res.status(500).json({ error: insertError.message });
      return;
    }

    const isSalon = body.serviceType === 'friseur';
    const businessLabel = isSalon ? 'Salon' : 'Restaurant';
    const businessName = body.restaurantName?.trim() || (isSalon ? 'Ihr Salon' : 'Ihr Betrieb');
    const guestName = body.guestName?.trim() || 'Gast';
    const greeting = getTimeBasedGreeting();
    const bookingNounLower = isSalon ? 'Termin' : 'Reservierung';
    const bookingCopy = isSalon
      ? {
          newTitle: 'Neuer Termin',
          newSentence: 'Ein neuer Termin ist eingegangen. Alle Details finden Sie unten.',
          confirmTitle: 'Termin bestätigt',
          confirmThanks: `${greeting} ${guestName}, Ihr Termin bei ${businessName} wurde erfolgreich bestätigt.`,
          thanksLine: 'Vielen Dank für Ihre Buchung.'
        }
      : {
          newTitle: 'Neue Reservierung',
          newSentence: 'Eine neue Reservierung ist eingegangen. Alle Details finden Sie unten.',
          confirmTitle: 'Reservierung bestätigt',
          confirmThanks: `${greeting} ${guestName}, Ihre Reservierung bei ${businessName} wurde erfolgreich bestätigt.`,
          thanksLine: 'Vielen Dank für Ihre Buchung.'
        };

    const details = [
      { label: businessLabel, value: body.restaurantName || '-' },
      { label: 'Datum', value: body.date || '-' },
      { label: 'Uhrzeit', value: body.time || '-' },
      { label: 'Name', value: body.guestName || '-' },
      { label: 'E-Mail', value: body.guestEmail || '-' },
      { label: 'Telefon', value: body.phone || '-' },
      ...(isSalon
        ? [{ label: 'Service', value: body.service || '-' }]
        : [{ label: 'Personen', value: body.people ? String(body.people) : '-' }]),
      { label: 'Notiz', value: body.note || '-' }
    ];

    const restaurantHtml = buildEmailLayout({
      brand: businessName,
      title: bookingCopy.newTitle,
      intro: bookingCopy.newSentence,
      rows: details,
      footer: 'Sie können auf diese E-Mail antworten, um direkt mit dem Gast zu kommunizieren.',
      footerLink: platformUrl,
      footerLinkLabel: 'NexTime - einfache Terminplanung.'
    });

    const guestRows = [
      { label: businessLabel, value: body.restaurantName || '-' },
      { label: 'Datum', value: body.date || '-' },
      { label: 'Uhrzeit', value: body.time || '-' },
      ...(body.note ? [{ label: 'Notiz', value: body.note }] : []),
      ...(isSalon
        ? [{ label: 'Service', value: body.service || '-' }]
        : [{ label: 'Personen', value: body.people ? String(body.people) : '-' }])
    ];

    const guestHtml = buildEmailLayout({
      brand: businessName,
      title: bookingCopy.confirmTitle,
      intro: bookingCopy.confirmThanks,
      rows: guestRows,
      footer: `Bei Rückfragen können Sie direkt auf diese E-Mail antworten. ${bookingCopy.thanksLine}`,
      footerLink: platformUrl,
      footerLinkLabel: 'NexTime - einfache Terminplanung.'
    });

    await resend.emails.send({
      from,
      to: body.restaurantEmail,
      subject: `${bookingCopy.newTitle} | ${businessName} | ${body.date} um ${body.time}`,
      replyTo: body.guestEmail,
      text: [
        `Neue ${bookingNounLower}`,
        '',
        `${businessLabel}: ${businessName}`,
        `Datum: ${body.date || '-'}`,
        `Uhrzeit: ${body.time || '-'}`,
        `Name: ${guestName}`,
        `E-Mail: ${body.guestEmail || '-'}`,
        body.phone ? `Telefon: ${body.phone}` : null,
        isSalon ? (body.service ? `Service: ${body.service}` : null) : body.people ? `Personen: ${body.people}` : null,
        body.note ? `Notiz: ${body.note}` : null
      ]
        .filter(Boolean)
        .concat(['', 'Sie können auf diese E-Mail antworten, um direkt mit dem Gast zu kommunizieren.'])
        .concat(['', 'NexTime - einfache Terminplanung.', platformUrl])
        .join('\n'),
      html: restaurantHtml
    });

    await resend.emails.send({
      from,
      to: body.guestEmail,
      subject: `${bookingCopy.confirmTitle} – ${businessName} (${body.date}, ${body.time})`,
      replyTo: body.restaurantEmail,
      text: [
        `${greeting} ${guestName},`,
        '',
        `Ihre ${bookingNounLower} bei ${businessName} wurde erfolgreich bestätigt.`,
        '',
        `Datum: ${body.date || '-'}`,
        `Uhrzeit: ${body.time || '-'}`,
        body.note ? `Notiz: ${body.note}` : null,
        isSalon ? (body.service ? `Service: ${body.service}` : null) : body.people ? `Personen: ${body.people}` : null,
        '',
        'Bei Rückfragen antworten Sie direkt auf diese E-Mail.',
        '',
        'Beste Grüße',
        `${businessName}`
      ]
        .filter(Boolean)
        .concat(['', 'NexTime - einfache Terminplanung.', platformUrl])
        .join('\n'),
      html: guestHtml
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('reservations api error', error);
    res.status(500).json({ error: 'Email send failed' });
  }
};
