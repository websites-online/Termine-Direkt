// eslint-disable-next-line @typescript-eslint/no-var-requires
const { verifyBookingActionToken } = require('../_lib/booking-action-token');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sendBookingConfirmation, formatDate } = require('../_lib/booking-emails');

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

const renderPage = (
  title: string,
  message: string,
  status: 'ok' | 'error',
  details?: { businessName: string; date: string; time: string },
) => `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{margin:0;padding:22px;background:linear-gradient(180deg,#eef2ff,#f8fafc);font-family:Arial,sans-serif;color:#172033}.card{max-width:560px;margin:7vh auto;background:#fff;border:1px solid #e4e8f0;border-radius:22px;box-shadow:0 20px 55px rgba(25,35,58,.12);overflow:hidden}.head{padding:28px;background:${status === 'ok' ? 'linear-gradient(135deg,#0f8f82,#14b8a6)' : 'linear-gradient(135deg,#b42318,#ef4444)'};color:#fff}.mark{font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;opacity:.9}.body{padding:28px}h1{margin:0 0 12px;font-size:28px;line-height:1.2}p{margin:0;color:#536078;line-height:1.65}.details{margin-top:22px;padding:17px;border-radius:14px;background:#f8fafc}.row{display:flex;justify-content:space-between;gap:18px;padding:7px 0;color:#64748b;font-size:14px}.row strong{color:#172033;text-align:right}</style></head>
<body><main class="card"><div class="head"><div class="mark">NexTime</div><h1>${escapeHtml(title)}</h1></div><div class="body"><p>${escapeHtml(message)}</p>${
  details
    ? `<div class="details"><div class="row"><span>Unternehmen</span><strong>${escapeHtml(details.businessName)}</strong></div><div class="row"><span>Datum</span><strong>${escapeHtml(formatDate(details.date, true))}</strong></div><div class="row"><span>Uhrzeit</span><strong>${escapeHtml(details.time)} Uhr</strong></div></div>`
    : ''
}</div></main></body></html>`;

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
  try {
    const token = typeof req.query?.token === 'string' ? req.query.token : '';
    const parsed = verifyBookingActionToken(token, 'confirm-alternative');
    if (!parsed) {
      sendPage(
        res,
        410,
        renderPage(
          'Vorschlag abgelaufen',
          'Dieser Vorschlag ist nicht mehr gültig. Bitte antworten Sie auf die E-Mail, um einen neuen Termin abzustimmen.',
          'error',
        ),
      );
      return;
    }

    const supabase = getClient();
    const { data: requestRow, error: requestError } = await supabase
      .from('booking_requests')
      .select(
        'id,restaurant_slug,restaurant_name,restaurant_email,guest_name,guest_email,phone,people,note,status,proposed_date,proposed_time,alternative_sent_at,alternative_expires_at,confirmation_email_sent_at',
      )
      .eq('id', parsed.requestId)
      .maybeSingle();
    if (requestError || !requestRow) {
      sendPage(
        res,
        requestRow ? 500 : 404,
        renderPage(
          'Anfrage nicht gefunden',
          requestError?.message || 'Die Anfrage existiert nicht mehr.',
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
    const details = {
      businessName: requestRow.restaurant_name || company.name,
      date: requestRow.proposed_date,
      time: requestRow.proposed_time,
    };

    const existingResult = await supabase
      .from('reservations')
      .select('id,date,time')
      .eq('booking_request_id', requestRow.id)
      .maybeSingle();
    if (existingResult.error) {
      sendPage(
        res,
        500,
        renderPage('Termin konnte nicht geprüft werden', 'Bitte später erneut versuchen.', 'error'),
      );
      return;
    }
    if (existingResult.data || requestRow.status === 'approved') {
      sendPage(
        res,
        200,
        renderPage(
          'Bereits bestätigt',
          'Der Termin ist bereits verbindlich in den Kalender eingetragen.',
          'ok',
          existingResult.data
            ? { ...details, date: existingResult.data.date, time: existingResult.data.time }
            : details,
        ),
      );
      return;
    }

    if (
      requestRow.status !== 'alternative_sent' ||
      !requestRow.proposed_date ||
      !requestRow.proposed_time ||
      !requestRow.alternative_expires_at ||
      parsed.proposedDate !== requestRow.proposed_date ||
      parsed.proposedTime !== requestRow.proposed_time ||
      !parsed.sentAt ||
      new Date(parsed.sentAt).getTime() !== new Date(requestRow.alternative_sent_at).getTime() ||
      Date.now() > new Date(requestRow.alternative_expires_at).getTime()
    ) {
      sendPage(
        res,
        410,
        renderPage(
          'Vorschlag abgelaufen',
          'Der Zeitpunkt ist nicht mehr reserviert. Bitte antworten Sie auf die E-Mail, um eine neue Zeit abzustimmen.',
          'error',
        ),
      );
      return;
    }

    const [reservationCount, otherHoldCount] = await Promise.all([
      supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_slug', requestRow.restaurant_slug)
        .eq('date', requestRow.proposed_date)
        .eq('time', requestRow.proposed_time),
      supabase
        .from('booking_requests')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_slug', requestRow.restaurant_slug)
        .eq('status', 'alternative_sent')
        .eq('proposed_date', requestRow.proposed_date)
        .eq('proposed_time', requestRow.proposed_time)
        .gt('alternative_expires_at', new Date().toISOString())
        .neq('id', requestRow.id),
    ]);
    if (reservationCount.error || otherHoldCount.error) {
      sendPage(
        res,
        500,
        renderPage('Termin konnte nicht geprüft werden', 'Bitte später erneut versuchen.', 'error'),
      );
      return;
    }
    const capacity = typeof company.slot_capacity === 'number' ? company.slot_capacity : 3;
    if ((reservationCount.count || 0) + (otherHoldCount.count || 0) >= capacity) {
      sendPage(
        res,
        409,
        renderPage(
          'Zeitpunkt nicht mehr frei',
          'Leider wurde dieser Zeitpunkt inzwischen belegt. Bitte antworten Sie auf die E-Mail, um eine neue Alternative zu erhalten.',
          'error',
        ),
      );
      return;
    }

    const confirmedRequest = {
      ...requestRow,
      date: requestRow.proposed_date,
      time: requestRow.proposed_time,
    };
    const { error: insertError } = await supabase.from('reservations').insert({
      restaurant_slug: requestRow.restaurant_slug,
      restaurant_name: requestRow.restaurant_name || company.name,
      restaurant_email: requestRow.restaurant_email || company.email,
      guest_name: requestRow.guest_name,
      guest_email: requestRow.guest_email,
      phone: requestRow.phone,
      people: requestRow.people,
      note: requestRow.note,
      date: requestRow.proposed_date,
      time: requestRow.proposed_time,
      booking_request_id: requestRow.id,
    });
    if (insertError && insertError.code !== '23505') {
      sendPage(res, 500, renderPage('Bestätigung fehlgeschlagen', insertError.message, 'error'));
      return;
    }
    const insertedNow = !insertError;

    const { error: updateError } = await supabase
      .from('booking_requests')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', requestRow.id);
    if (updateError) {
      if (insertedNow) {
        await supabase.from('reservations').delete().eq('booking_request_id', requestRow.id);
      }
      sendPage(
        res,
        500,
        renderPage('Bestätigung fehlgeschlagen', 'Bitte später erneut versuchen.', 'error'),
      );
      return;
    }

    if (!requestRow.confirmation_email_sent_at) {
      try {
        await sendBookingConfirmation(confirmedRequest, company);
        await supabase
          .from('booking_requests')
          .update({ confirmation_email_sent_at: new Date().toISOString() })
          .eq('id', requestRow.id);
      } catch (emailError) {
        console.error('alternative confirmation email failed', emailError);
      }
    }

    sendPage(
      res,
      200,
      renderPage(
        'Termin bestätigt',
        'Vielen Dank! Der vorgeschlagene Zeitpunkt ist jetzt verbindlich für Sie eingetragen.',
        'ok',
        details,
      ),
    );
  } catch (error: any) {
    console.error('alternative confirmation error', error);
    sendPage(
      res,
      500,
      renderPage('Interner Fehler', error?.message || 'Bitte später erneut versuchen.', 'error'),
    );
  }
};
