const getActionSecret = (): string => {
  const secret = process.env.BOOKING_ACTION_SECRET?.trim();
  if (!secret) {
    throw new Error('Missing BOOKING_ACTION_SECRET');
  }
  return secret;
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

const fromBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
};

const signaturesMatch = (left: string, right: string): boolean => {
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
  } catch {
    return false;
  }
};

const verifyToken = (token: string): { requestId: string; exp: number } | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return null;
    }
    const [payloadPart, signature] = parts;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', getActionSecret())
      .update(payloadPart)
      .digest('hex');

    if (!signaturesMatch(signature, expectedSignature)) {
      return null;
    }

    const payload = JSON.parse(fromBase64Url(payloadPart));
    if (!payload?.requestId || !payload?.exp || payload.action !== 'reject') {
      return null;
    }
    if (Date.now() > Number(payload.exp)) {
      return null;
    }
    return { requestId: String(payload.requestId), exp: Number(payload.exp) };
  } catch {
    return null;
  }
};

const createMailtoLink = (email: string, subject: string, body: string): string =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    body.replace(/\r?\n/g, '\r\n'),
  )}`;

const formatDisplayDate = (dateValue?: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || '').trim());
  return match ? `${match[3]}.${match[2]}.${match[1]}` : dateValue || '-';
};

const formatLongDisplayDate = (dateValue?: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || '').trim());
  if (!match) {
    return formatDisplayDate(dateValue);
  }
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(new Date(`${dateValue}T12:00:00Z`));
};

const extractFromNote = (note: string | null, key: string): string => {
  if (!note) {
    return '';
  }
  const match = note.match(new RegExp(`${key}:\\s*([^|]+)`, 'i'));
  return match?.[1]?.trim() || '';
};

const sendHtmlResponse = (res: any, statusCode: number, title: string, message: string) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a"><main style="max-width:600px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px"><h1 style="font-size:24px;margin:0 0 12px">${title}</h1><p style="line-height:1.6;margin:0">${message}</p></main></body></html>`,
  );
};

module.exports = async function handler(req: any, res: any) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const token = typeof req.query?.token === 'string' ? req.query.token : '';
    const payload = verifyToken(token);
    if (!payload) {
      sendHtmlResponse(
        res,
        400,
        'Link ungültig',
        'Dieser Ablehnen-Link ist ungültig oder abgelaufen.',
      );
      return;
    }

    const supabase = getClient();
    const { data: requestRow, error: requestError } = await supabase
      .from('booking_requests')
      .select(
        'id,restaurant_slug,restaurant_name,guest_name,guest_email,date,time,people,note,status',
      )
      .eq('id', payload.requestId)
      .maybeSingle();

    if (requestError) {
      throw requestError;
    }
    if (!requestRow) {
      sendHtmlResponse(
        res,
        404,
        'Anfrage nicht gefunden',
        'Diese Anfrage ist nicht mehr vorhanden.',
      );
      return;
    }
    if (requestRow.status === 'approved') {
      sendHtmlResponse(
        res,
        409,
        'Bereits angenommen',
        'Diese Anfrage wurde bereits angenommen und kann nicht mehr abgelehnt werden.',
      );
      return;
    }

    const { data: company } = await supabase
      .from('companies')
      .select('name,service_type')
      .eq('slug', requestRow.restaurant_slug)
      .maybeSingle();

    if (requestRow.status !== 'rejected') {
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: 'rejected' })
        .eq('id', requestRow.id);
      if (updateError) {
        throw updateError;
      }
    }

    const businessName =
      String(requestRow.restaurant_name || company?.name || '').trim() || 'Ihr Betrieb';
    const guestName = String(requestRow.guest_name || 'Gast').trim();
    const longDisplayDate = formatLongDisplayDate(requestRow.date);
    const isSalon = company?.service_type === 'friseur';
    const service = extractFromNote(requestRow.note || null, 'Service');
    const stylist =
      extractFromNote(requestRow.note || null, 'Friseur') ||
      extractFromNote(requestRow.note || null, 'Wunsch-Friseur');
    const seating = extractFromNote(requestRow.note || null, 'Sitzplatz');
    const mailto = createMailtoLink(
      requestRow.guest_email || '',
      `Alternativvorschlag von ${businessName}`,
      [
        `Guten Tag ${guestName},`,
        '',
        `vielen Dank für Ihre Anfrage bei ${businessName}.`,
        '',
        isSalon
          ? 'Leider können wir den gewünschten Termin so nicht bestätigen.'
          : 'Leider können wir die gewünschte Reservierung so nicht bestätigen.',
        '',
        isSalon ? 'Ihr angefragter Termin' : 'Ihre angefragte Reservierung',
        '────────────────────────',
        `Datum: ${longDisplayDate}`,
        `Uhrzeit: ${requestRow.time ? `${requestRow.time} Uhr` : '-'}`,
        isSalon
          ? service
            ? `Service: ${service}`
            : null
          : requestRow.people
            ? `Personen: ${requestRow.people}`
            : null,
        isSalon && stylist ? `Friseur: ${stylist}` : null,
        !isSalon && seating ? `Sitzplatz: ${seating}` : null,
        '────────────────────────',
        '',
        'Unser Alternativvorschlag',
        '────────────────────────',
        'Datum: [DATUM EINFÜGEN]',
        'Uhrzeit: [UHRZEIT EINFÜGEN]',
        '────────────────────────',
        '',
        'Passt dieser Vorschlag für Sie? Antworten Sie uns einfach kurz auf diese E-Mail.',
        '',
        'Falls Sie noch eine Frage haben, können Sie ebenfalls direkt auf diese E-Mail antworten.',
        '',
        'Herzliche Grüße',
        `Ihr Team von ${businessName}`,
        '',
        '—',
        'Terminplanung mit NexTime',
        'https://nextime-booking.de',
      ]
        .filter((line): line is string => line !== null)
        .join('\r\n'),
    );

    res.statusCode = 302;
    res.setHeader('Location', mailto);
    res.setHeader('Cache-Control', 'no-store');
    res.end();
  } catch (error: any) {
    console.error('booking request rejection error', error);
    sendHtmlResponse(
      res,
      500,
      'Ablehnen fehlgeschlagen',
      'Die Anfrage konnte gerade nicht abgelehnt werden. Bitte versuchen Sie es erneut.',
    );
  }
};
