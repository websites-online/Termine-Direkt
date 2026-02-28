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
    const fromName = body.restaurantName ? `${body.restaurantName} ` : '';
    const from = fromName ? `${fromName}<${fromAddress}>` : fromAddress;

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
    const bookingCopy = isSalon
      ? {
          newTitle: 'Neuer Termin',
          newSentence: 'Ein neuer Termin ist eingegangen.',
          confirmTitle: 'Termin bestätigt',
          confirmThanks: `Danke für Ihren Termin${body.restaurantName ? ` bei ${body.restaurantName}` : ''}.`,
          subjectNew: 'Neuer Termin',
          subjectYour: 'Ihr Termin',
          thanksLine: 'Danke für Ihren Termin!'
        }
      : {
          newTitle: 'Neue Reservierung',
          newSentence: 'Eine neue Reservierung ist eingegangen.',
          confirmTitle: 'Reservierung bestätigt',
          confirmThanks: `Danke für Ihre Reservierung${body.restaurantName ? ` bei ${body.restaurantName}` : ''}.`,
          subjectNew: 'Neue Reservierung',
          subjectYour: 'Ihre Reservierung',
          thanksLine: 'Danke für Ihre Reservierung!'
        };

    const details = [
      { label: businessLabel, value: body.restaurantName || '-' },
      { label: 'Datum', value: body.date },
      { label: 'Uhrzeit', value: body.time },
      { label: 'Name', value: body.guestName || '-' },
      { label: 'E-Mail', value: body.guestEmail },
      { label: 'Telefon', value: body.phone || '-' },
      ...(isSalon
        ? [{ label: 'Service', value: body.service || '-' }]
        : [{ label: 'Personen', value: body.people ? String(body.people) : '-' }]),
      { label: 'Notiz', value: body.note || '-' }
    ];

    const restaurantHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;background:#f8fafc;padding:24px">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px">
          <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">${bookingCopy.newTitle}</h2>
          <p style="margin:0 0 16px;color:#475569">${bookingCopy.newSentence}</p>
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
          <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">${bookingCopy.confirmTitle}</h2>
          <p style="margin:0 0 16px;color:#475569">${bookingCopy.confirmThanks}</p>
          <div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-top:12px">
            <div style="margin:6px 0"><strong style="display:inline-block;min-width:120px;color:#0f172a">Datum:</strong> <span style="color:#334155">${body.date}</span></div>
            <div style="margin:6px 0"><strong style="display:inline-block;min-width:120px;color:#0f172a">Uhrzeit:</strong> <span style="color:#334155">${body.time}</span></div>
            ${
              isSalon
                ? body.service
                  ? `<div style="margin:6px 0"><strong style="display:inline-block;min-width:120px;color:#0f172a">Service:</strong> <span style="color:#334155">${body.service}</span></div>`
                  : ''
                : body.people
                  ? `<div style="margin:6px 0"><strong style="display:inline-block;min-width:120px;color:#0f172a">Personen:</strong> <span style="color:#334155">${body.people}</span></div>`
                  : ''
            }
          </div>
          <p style="margin:16px 0 0;color:#475569">Wir freuen uns auf Ihren Besuch.</p>
        </div>
      </div>
    `;

    await resend.emails.send({
      from,
      to: body.restaurantEmail,
      subject: `${bookingCopy.subjectNew}: ${body.date} ${body.time}`,
      replyTo: body.guestEmail,
      text: [
        `${businessLabel}: ${body.restaurantName || '-'}`,
        `Datum: ${body.date}`,
        `Uhrzeit: ${body.time}`,
        `Name: ${body.guestName || '-'}`,
        `E-Mail: ${body.guestEmail}`,
        body.phone ? `Telefon: ${body.phone}` : null,
        isSalon ? (body.service ? `Service: ${body.service}` : null) : body.people ? `Personen: ${body.people}` : null,
        body.note ? `Notiz: ${body.note}` : null
      ]
        .filter(Boolean)
        .join('\n'),
      html: restaurantHtml
    });

    await resend.emails.send({
      from,
      to: body.guestEmail,
      subject: `${bookingCopy.subjectYour} bei ${body.restaurantName || 'dem Betrieb'}`,
      replyTo: body.restaurantEmail,
      text: [
        bookingCopy.thanksLine,
        `Datum: ${body.date}`,
        `Uhrzeit: ${body.time}`,
        isSalon ? (body.service ? `Service: ${body.service}` : null) : body.people ? `Personen: ${body.people}` : null
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
