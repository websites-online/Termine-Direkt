// eslint-disable-next-line @typescript-eslint/no-var-requires
const { verifyBookingActionToken } = require('../_lib/booking-action-token');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sendBookingConfirmation } = require('../_lib/booking-emails');

const getClient = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE key');
  return createClient(url, key);
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isMissingColumnError = (error: any, column: string): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42703' || error?.code === 'PGRST204' || message.includes(column);
};

const renderPage = (
  title: string,
  message: string,
  status: 'ok' | 'error',
  closeWindow = false,
) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{margin:0;padding:24px;background:#f3f5f9;font-family:Arial,sans-serif;color:#172033}.card{max-width:540px;margin:8vh auto;background:#fff;border:1px solid #e4e8f0;border-radius:20px;box-shadow:0 18px 50px rgba(25,35,58,.1);overflow:hidden}.head{padding:24px;background:${status === 'ok' ? '#0f8f82' : '#b42318'};color:#fff;font-weight:800}.body{padding:26px}h1{margin:0 0 10px;font-size:25px}p{margin:0;color:#536078;line-height:1.6}.hint{margin-top:18px;font-size:12px;color:#8992a3}</style>
${closeWindow ? '<script>window.setTimeout(function(){window.close()},1600)</script>' : ''}</head>
<body><main class="card"><div class="head">NexTime Anfrage-Service</div><div class="body"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><div class="hint">${closeWindow ? 'Dieses Fenster schließt sich, wenn es vom E-Mail-Programm separat geöffnet wurde.' : 'Sie können dieses Fenster schließen.'}</div></div></main></body></html>`;

const sendPage = (res: any, status: number, html: string) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
};

module.exports = async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!process.env.BOOKING_ACTION_SECRET?.trim()) {
    sendPage(res, 500, renderPage('Konfiguration fehlt', 'BOOKING_ACTION_SECRET fehlt.', 'error'));
    return;
  }

  try {
    const token = typeof req.query?.token === 'string' ? req.query.token : '';
    const parsedToken = verifyBookingActionToken(token, 'approve');
    if (!parsedToken) {
      sendPage(
        res,
        400,
        renderPage('Link ungültig', 'Der Link ist ungültig oder bereits abgelaufen.', 'error'),
      );
      return;
    }

    const supabase = getClient();
    const { data: requestRow, error: requestError } = await supabase
      .from('booking_requests')
      .select(
        'id,restaurant_slug,restaurant_name,restaurant_email,guest_name,guest_email,phone,people,note,date,time,status,confirmation_email_sent_at',
      )
      .eq('id', parsedToken.requestId)
      .maybeSingle();
    if (requestError || !requestRow) {
      sendPage(
        res,
        requestRow ? 500 : 404,
        renderPage(
          requestRow ? 'Anfrage konnte nicht geladen werden' : 'Anfrage nicht gefunden',
          isMissingColumnError(requestError, 'confirmation_email_sent_at')
            ? 'Bitte zuerst die aktuelle Supabase-Migration ausführen.'
            : requestError?.message || 'Diese Anfrage existiert nicht mehr.',
          'error',
        ),
      );
      return;
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('slug,name,email,service_type,slot_capacity')
      .eq('slug', requestRow.restaurant_slug)
      .maybeSingle();
    if (companyError || !company) {
      sendPage(
        res,
        500,
        renderPage('Unternehmen nicht gefunden', 'Bitte später erneut versuchen.', 'error'),
      );
      return;
    }

    const existingResult = await supabase
      .from('reservations')
      .select('id')
      .eq('booking_request_id', requestRow.id)
      .maybeSingle();
    if (existingResult.error) {
      sendPage(
        res,
        500,
        renderPage(
          'Migration fehlt',
          'Bitte zuerst die aktuelle Supabase-Migration ausführen.',
          'error',
        ),
      );
      return;
    }

    if (!existingResult.data) {
      const [reservationCount, holdCount] = await Promise.all([
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_slug', requestRow.restaurant_slug)
          .eq('date', requestRow.date)
          .eq('time', requestRow.time),
        supabase
          .from('booking_requests')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_slug', requestRow.restaurant_slug)
          .eq('status', 'alternative_sent')
          .eq('proposed_date', requestRow.date)
          .eq('proposed_time', requestRow.time)
          .gt('alternative_expires_at', new Date().toISOString())
          .neq('id', requestRow.id),
      ]);
      if (reservationCount.error || holdCount.error) {
        sendPage(
          res,
          500,
          renderPage('Prüfung fehlgeschlagen', 'Bitte später erneut versuchen.', 'error'),
        );
        return;
      }
      const capacity = typeof company.slot_capacity === 'number' ? company.slot_capacity : 3;
      if ((reservationCount.count || 0) + (holdCount.count || 0) >= capacity) {
        sendPage(
          res,
          409,
          renderPage(
            'Uhrzeit inzwischen belegt',
            'Öffnen Sie die Anfrage im Unternehmenslogin und bieten Sie eine Alternative an.',
            'error',
          ),
        );
        return;
      }

      const { error: insertError } = await supabase.from('reservations').insert({
        restaurant_slug: requestRow.restaurant_slug,
        restaurant_name: requestRow.restaurant_name || company.name,
        restaurant_email: requestRow.restaurant_email || company.email,
        guest_name: requestRow.guest_name,
        guest_email: requestRow.guest_email,
        phone: requestRow.phone,
        people: requestRow.people,
        note: requestRow.note,
        date: requestRow.date,
        time: requestRow.time,
        booking_request_id: requestRow.id,
      });
      if (insertError && insertError.code !== '23505') {
        sendPage(
          res,
          500,
          renderPage('Termin konnte nicht gespeichert werden', insertError.message, 'error'),
        );
        return;
      }
    }

    const { error: updateError } = await supabase
      .from('booking_requests')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', requestRow.id);
    if (updateError) {
      sendPage(
        res,
        500,
        renderPage('Anfrage konnte nicht bestätigt werden', updateError.message, 'error'),
      );
      return;
    }

    let emailSent = Boolean(requestRow.confirmation_email_sent_at);
    if (!emailSent) {
      try {
        await sendBookingConfirmation(requestRow, company);
        emailSent = true;
        await supabase
          .from('booking_requests')
          .update({ confirmation_email_sent_at: new Date().toISOString() })
          .eq('id', requestRow.id);
      } catch (emailError) {
        console.error('automatic confirmation email failed', emailError);
      }
    }

    sendPage(
      res,
      200,
      renderPage(
        emailSent ? 'Termin bestätigt' : 'Termin gespeichert',
        emailSent
          ? 'Der Termin steht jetzt fest im Kalender und die Bestätigung wurde automatisch versendet.'
          : 'Der Termin steht fest im Kalender. Die Bestätigungs-E-Mail konnte jedoch nicht versendet werden.',
        'ok',
        true,
      ),
    );
  } catch (error: any) {
    console.error('booking request approval error', error);
    sendPage(
      res,
      500,
      renderPage('Interner Fehler', error?.message || 'Bitte später erneut versuchen.', 'error'),
    );
  }
};
