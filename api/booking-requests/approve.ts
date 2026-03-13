const platformUrl =
  process.env.PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  'https://nextime-booking.de';

const normalizedPlatformUrl = platformUrl.replace(/\/+$/, '');

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

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const createMailtoLink = (email: string, subject: string, body: string): string =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

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
    if (!payload?.requestId || !payload?.exp) {
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

const formatDisplayDate = (dateValue?: string): string => {
  if (!dateValue) {
    return '-';
  }
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim());
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  }
  return dateValue;
};

const extractFromNote = (note: string | null, key: string): string => {
  if (!note) {
    return '';
  }
  const match = note.match(new RegExp(`${key}:\\s*([^|]+)`, 'i'));
  return match?.[1]?.trim() || '';
};

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

const buildEmailLayout = ({
  brand,
  title,
  intro,
  rows,
  footer
}: {
  brand: string;
  title: string;
  intro: string;
  rows: Array<{ label: string; value: string }>;
  footer: string;
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
                <div style="white-space:pre-line;text-align:center">${escapeHtml(footer)}</div>
                <div style="margin-top:16px;text-align:center">
                  <a href="${escapeHtml(normalizedPlatformUrl)}" style="color:#4338ca;text-decoration:none;font-weight:700">NexTime - einfache Terminplanung</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`;

const renderResultPage = (
  title: string,
  message: string,
  status: 'ok' | 'error',
  actions?: Array<{ href: string; label: string; variant?: 'primary' | 'secondary' }>
) => `
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: Arial, Helvetica, sans-serif; background: linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%); margin: 0; padding: 24px; }
      .wrap { max-width: 760px; margin: 26px auto; }
      .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.10); }
      .head { padding: 18px 22px; background: linear-gradient(95deg, #4338ca 0%, #4f46e5 100%); color: #fff; }
      .badge { display: inline-block; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.18); margin-bottom: 10px; }
      .body { padding: 24px 22px 22px; }
      h1 { margin: 0 0 10px; font-size: 28px; color: #0f172a; }
      p { margin: 0; color: #334155; line-height: 1.55; }
      .ok { color: #166534; }
      .error { color: #991b1b; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
      .btn { display: inline-block; border-radius: 10px; padding: 10px 14px; font-size: 14px; font-weight: 700; text-decoration: none; }
      .btn-primary { background: #4338ca; color: #fff; }
      .btn-secondary { border: 1px solid #c7d2fe; color: #4338ca; background: #fff; }
      .meta { margin-top: 16px; font-size: 12px; color: #64748b; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="head">
          <span class="badge">${status === 'ok' ? 'Bestätigt' : 'Hinweis'}</span>
          <div>NexTime Anfrage-Service</div>
        </div>
        <div class="body">
          <h1 class="${status === 'ok' ? 'ok' : 'error'}">${escapeHtml(title)}</h1>
          <p>${escapeHtml(message)}</p>
          <div class="actions">
            <a class="btn btn-primary" href="${escapeHtml(normalizedPlatformUrl)}">Zur Website</a>
            ${(actions || [])
              .map(
                (action) =>
                  `<a class="btn ${action.variant === 'secondary' ? 'btn-secondary' : 'btn-primary'}" href="${escapeHtml(
                    action.href
                  )}">${escapeHtml(action.label)}</a>`
              )
              .join('')}
          </div>
          <div class="meta">Sie können dieses Fenster nach dem Prüfen schließen.</div>
        </div>
      </div>
    </div>
  </body>
</html>`;

const sendHtmlResponse = (res: any, statusCode: number, html: string) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
};

const isMissingColumnError = (error: any, columnName: string): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42703' || message.includes(columnName.toLowerCase());
};

module.exports = async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.BOOKING_ACTION_SECRET?.trim()) {
    sendHtmlResponse(
      res,
      500,
      renderResultPage(
        'Konfiguration fehlt',
        'BOOKING_ACTION_SECRET ist nicht gesetzt. Bitte in Vercel Environment Variables hinterlegen.',
        'error'
      )
    );
    return;
  }

  try {
    const token = typeof req.query?.token === 'string' ? req.query.token : '';
    const parsedToken = verifyToken(token);
    if (!parsedToken) {
      sendHtmlResponse(
        res,
        400,
        renderResultPage(
          'Link ungültig oder abgelaufen',
          'Bitte öffnen Sie die aktuelle Anfrage-Mail erneut und klicken Sie auf den Bestätigungslink.',
          'error'
        )
      );
      return;
    }

    const supabase = getClient();
    const { data: requestRow, error: requestError } = await supabase
      .from('booking_requests')
      .select(
        'id,restaurant_slug,restaurant_name,restaurant_email,guest_name,guest_email,phone,people,note,date,time,status'
      )
      .eq('id', parsedToken.requestId)
      .maybeSingle();

    if (requestError) {
      if (isMissingColumnError(requestError, 'status')) {
        sendHtmlResponse(
          res,
          500,
          renderResultPage(
            'Migration fehlt',
            'Bitte zuerst die neuen Spalten fuer booking_requests und reservations in Supabase anlegen.',
            'error'
          )
        );
        return;
      }
      sendHtmlResponse(
        res,
        500,
        renderResultPage('Fehler beim Laden', `Datenbankfehler: ${requestError.message}`, 'error')
      );
      return;
    }

    if (!requestRow) {
      sendHtmlResponse(
        res,
        404,
        renderResultPage(
          'Anfrage nicht gefunden',
          'Die Anfrage existiert nicht mehr oder wurde bereits verarbeitet.',
          'error'
        )
      );
      return;
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('slug,name,email,service_type,slot_capacity')
      .eq('slug', requestRow.restaurant_slug)
      .maybeSingle();

    if (companyError || !company) {
      sendHtmlResponse(
        res,
        500,
        renderResultPage(
          'Unternehmen nicht gefunden',
          'Die zugehoerige Firma konnte nicht geladen werden.',
          'error'
        )
      );
      return;
    }

    const slotCapacity = typeof company.slot_capacity === 'number' ? company.slot_capacity : 3;
    const isSalon = company.service_type === 'friseur';
    const businessName = (requestRow.restaurant_name || company.name || '').trim() || 'Ihr Betrieb';
    const guestName = (requestRow.guest_name || 'Gast').trim();
    const displayDate = formatDisplayDate(requestRow.date);
    const seating = extractFromNote(requestRow.note || null, 'Sitzplatz');
    const service = extractFromNote(requestRow.note || null, 'Service');
    const customerNote = extractFromNote(requestRow.note || null, 'Notiz');

    if (requestRow.status === 'approved') {
      sendHtmlResponse(
        res,
        200,
        renderResultPage(
          'Bereits bestätigt',
          'Diese Anfrage wurde bereits als Buchung übernommen.',
          'ok'
        )
      );
      return;
    }

    const { count, error: countError } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_slug', requestRow.restaurant_slug)
      .eq('date', requestRow.date)
      .eq('time', requestRow.time);

    if (countError) {
      sendHtmlResponse(
        res,
        500,
        renderResultPage('Fehler beim Prüfen', countError.message, 'error')
      );
      return;
    }

    if ((count || 0) >= slotCapacity) {
      const declineMailto = createMailtoLink(
        requestRow.guest_email || '',
        `${isSalon ? 'Terminanfrage' : 'Reservierungsanfrage'} zu ${displayDate} ${requestRow.time ? `(${requestRow.time})` : ''}`.trim(),
        `Guten Tag ${guestName},\n\nleider passt der angefragte Termin aktuell nicht.\n\nAlternative:\n\nBeste Grüße\n${businessName}`
      );
      sendHtmlResponse(
        res,
        409,
        renderResultPage(
          'Slot ist bereits voll',
          'Der gewählte Slot ist inzwischen ausgebucht. Bitte senden Sie dem Gast einen Alternativtermin.',
          'error',
          [{ href: declineMailto, label: 'Gast antworten', variant: 'secondary' }]
        )
      );
      return;
    }

    const { error: insertError } = await supabase.from('reservations').insert({
      restaurant_slug: requestRow.restaurant_slug,
      restaurant_name: requestRow.restaurant_name,
      restaurant_email: requestRow.restaurant_email,
      guest_name: requestRow.guest_name,
      guest_email: requestRow.guest_email,
      phone: requestRow.phone,
      people: requestRow.people,
      note: requestRow.note,
      date: requestRow.date,
      time: requestRow.time,
      booking_request_id: requestRow.id
    });

    if (insertError) {
      if (insertError.code === '23505') {
        sendHtmlResponse(
          res,
          200,
          renderResultPage(
            'Bereits bestätigt',
            'Diese Anfrage wurde bereits als Buchung übernommen.',
            'ok'
          )
        );
        return;
      }
      if (isMissingColumnError(insertError, 'booking_request_id')) {
        sendHtmlResponse(
          res,
          500,
          renderResultPage(
            'Migration fehlt',
            'Die Spalte booking_request_id in reservations fehlt noch. Bitte SQL-Migration ausführen.',
            'error'
          )
        );
        return;
      }
      sendHtmlResponse(
        res,
        500,
        renderResultPage('Bestätigung fehlgeschlagen', insertError.message, 'error')
      );
      return;
    }

    let { error: updateRequestError } = await supabase
      .from('booking_requests')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', requestRow.id);

    if (updateRequestError && isMissingColumnError(updateRequestError, 'approved_at')) {
      const fallback = await supabase
        .from('booking_requests')
        .update({ status: 'approved' })
        .eq('id', requestRow.id);
      updateRequestError = fallback.error;
    }

    if (updateRequestError) {
      console.error('booking request status update failed', updateRequestError);
    }

    if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
      sendHtmlResponse(
        res,
        200,
        renderResultPage(
          'Anfrage bestätigt',
          'Die Buchung wurde gespeichert. Kundenmail konnte nicht versendet werden (Mail-Konfiguration fehlt).',
          'ok'
        )
      );
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromNameSafe =
        businessName
          .replace(/[^\p{L}\p{N}\s&\-'.]/gu, '')
          .trim()
          .slice(0, 60) || 'Terminservice';
      const from = `${fromNameSafe} <${process.env.FROM_EMAIL}>`;
      const title = isSalon ? 'Termin bestätigt' : 'Reservierung bestätigt';
      const greeting = getTimeBasedGreeting();
      const rows = [
        { label: isSalon ? 'Salon' : 'Restaurant', value: businessName },
        { label: 'Datum', value: displayDate },
        { label: 'Uhrzeit', value: requestRow.time || '-' },
        ...(customerNote ? [{ label: 'Notiz', value: customerNote }] : []),
        ...(!isSalon && seating ? [{ label: 'Sitzplatz', value: seating }] : []),
        ...(isSalon
          ? [{ label: 'Service', value: service || '-' }]
          : [{ label: 'Personen', value: requestRow.people ? String(requestRow.people) : '-' }])
      ];
      const intro = isSalon
        ? `${greeting} ${guestName}, Ihr Termin bei ${businessName} wurde erfolgreich bestätigt.`
        : `${greeting} ${guestName}, Ihre Reservierung bei ${businessName} wurde erfolgreich bestätigt.`;
      const html = buildEmailLayout({
        brand: businessName,
        title,
        intro,
        rows,
        footer:
          'Bei Rückfragen können Sie direkt auf diese E-Mail antworten.\nDiese Bestätigung wurde auf Ihre Anfrage hin erstellt.'
      });

      await resend.emails.send({
        from,
        to: requestRow.guest_email,
        subject: `${title} | ${displayDate} ${requestRow.time ? `um ${requestRow.time}` : ''}`.trim(),
        replyTo: requestRow.restaurant_email,
        text: [
          `${greeting} ${guestName},`,
          '',
          isSalon
            ? `Ihr Termin bei ${businessName} wurde erfolgreich bestätigt.`
            : `Ihre Reservierung bei ${businessName} wurde erfolgreich bestätigt.`,
          '',
          `Datum: ${displayDate}`,
          `Uhrzeit: ${requestRow.time || '-'}`,
          customerNote ? `Notiz: ${customerNote}` : null,
          !isSalon && seating ? `Sitzplatz: ${seating}` : null,
          isSalon ? (service ? `Service: ${service}` : null) : requestRow.people ? `Personen: ${requestRow.people}` : null,
          '',
          'Bei Rückfragen antworten Sie direkt auf diese E-Mail.',
          '',
          'NexTime - einfache Terminplanung',
          normalizedPlatformUrl
        ]
          .filter(Boolean)
          .join('\n'),
        html
      });
    } catch (mailError: any) {
      console.error('approval confirmation mail failed', mailError);
      sendHtmlResponse(
        res,
        200,
        renderResultPage(
          'Anfrage bestätigt',
          'Die Buchung wurde gespeichert. Die Mail an den Gast konnte nicht gesendet werden.',
          'ok'
        )
      );
      return;
    }

    sendHtmlResponse(
      res,
      200,
      renderResultPage(
        'Anfrage bestätigt',
        'Die Anfrage wurde als Buchung übernommen und der Gast wurde automatisch informiert.',
        'ok'
      )
    );
  } catch (error: any) {
    console.error('booking request approval error', error);
    sendHtmlResponse(
      res,
      500,
      renderResultPage(
        'Interner Fehler',
        error?.message || 'Unbekannter Fehler beim Bestätigen der Anfrage.',
        'error'
      )
    );
  }
};
