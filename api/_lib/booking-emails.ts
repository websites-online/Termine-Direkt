const platformUrl = (
  process.env.PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  'https://nextime-booking.de'
).replace(/\/+$/, '');

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeHeader = (value: unknown): string =>
  String(value ?? '')
    .replace(/[\r\n<>]/g, ' ')
    .trim();

const formatDate = (dateValue?: string, long = false): string => {
  const value = String(dateValue || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value || '-';
  }
  return new Intl.DateTimeFormat('de-DE', {
    ...(long ? { weekday: 'long', month: 'long' as const } : { month: '2-digit' as const }),
    day: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(new Date(`${value}T12:00:00Z`));
};

const extractFromNote = (note: string | null | undefined, key: string): string => {
  if (!note) {
    return '';
  }
  return note.match(new RegExp(`${key}:\\s*([^|]+)`, 'i'))?.[1]?.trim() || '';
};

const renderRows = (rows: Array<{ label: string; value: string }>): string =>
  rows
    .filter((row) => row.value)
    .map(
      (row) => `<tr>
        <td style="padding:11px 0;color:#64748b;font-size:14px;border-bottom:1px solid #eef2f7">${escapeHtml(row.label)}</td>
        <td style="padding:11px 0;color:#172033;font-size:14px;font-weight:700;text-align:right;border-bottom:1px solid #eef2f7">${escapeHtml(row.value)}</td>
      </tr>`,
    )
    .join('');

const renderEmail = ({
  businessName,
  badge,
  title,
  intro,
  rows,
  accent = '#4338ca',
  action,
  notice,
}: {
  businessName: string;
  badge: string;
  title: string;
  intro: string;
  rows: Array<{ label: string; value: string }>;
  accent?: string;
  action?: { href: string; label: string };
  notice?: string;
}): string => `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#172033">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background:#fff;border:1px solid #e4e8f0;border-radius:20px;overflow:hidden;box-shadow:0 14px 40px rgba(25,35,58,.08)">
        <tr><td style="padding:28px;background:linear-gradient(135deg,${escapeHtml(accent)},#6366f1);color:#fff">
          <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.9">${escapeHtml(businessName)}</div>
          <div style="margin-top:16px"><span style="display:inline-block;padding:6px 11px;border-radius:99px;background:rgba(255,255,255,.18);font-size:12px;font-weight:800">${escapeHtml(badge)}</span></div>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.18">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td style="padding:28px 28px 10px;font-size:16px;line-height:1.65;color:#3e4a60">${escapeHtml(intro)}</td></tr>
        <tr><td style="padding:6px 28px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${renderRows(rows)}</table></td></tr>
        ${
          notice
            ? `<tr><td style="padding:0 28px 18px"><div style="padding:13px 15px;border-radius:12px;background:#f8fafc;color:#536078;font-size:13px;line-height:1.5">${escapeHtml(notice)}</div></td></tr>`
            : ''
        }
        ${
          action
            ? `<tr><td align="center" style="padding:4px 28px 26px"><a href="${escapeHtml(action.href)}" style="display:inline-block;padding:14px 22px;border-radius:11px;background:${escapeHtml(accent)};color:#fff;text-decoration:none;font-size:15px;font-weight:800">${escapeHtml(action.label)}</a></td></tr>`
            : ''
        }
        <tr><td style="padding:20px 28px;border-top:1px solid #edf0f5;color:#7b8597;font-size:12px;line-height:1.6;text-align:center">Bei Rückfragen antworten Sie einfach auf diese E-Mail.<br><a href="${escapeHtml(platformUrl)}" style="color:#4338ca;text-decoration:none;font-weight:700">Terminplanung mit NexTime</a></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const getEmailContext = (request: any, company: any) => {
  const isSalon = company?.service_type === 'friseur';
  const businessName = String(request.restaurant_name || company?.name || 'Ihr Betrieb').trim();
  const guestName = String(request.guest_name || 'Gast').trim();
  const rows = [
    { label: 'Datum', value: formatDate(request.date, true) },
    { label: 'Uhrzeit', value: request.time ? `${request.time} Uhr` : '-' },
    ...(isSalon
      ? [
          { label: 'Service', value: extractFromNote(request.note, 'Service') || '-' },
          { label: 'Friseur', value: extractFromNote(request.note, 'Friseur') },
        ]
      : [
          { label: 'Personen', value: request.people ? String(request.people) : '-' },
          { label: 'Sitzplatz', value: extractFromNote(request.note, 'Sitzplatz') },
        ]),
  ];
  return { isSalon, businessName, guestName, rows };
};

const sendEmail = async ({
  company,
  request,
  subject,
  text,
  html,
}: {
  company: any;
  request: any;
  subject: string;
  text: string;
  html: string;
}) => {
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) {
    throw new Error('RESEND_API_KEY oder FROM_EMAIL fehlt');
  }
  if (!request.guest_email) {
    throw new Error('Die Anfrage enthält keine Kunden-E-Mail');
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const businessName = safeHeader(request.restaurant_name || company?.name || 'NexTime');
  const result = await resend.emails.send({
    from: `${businessName} <${process.env.FROM_EMAIL}>`,
    to: request.guest_email,
    subject: safeHeader(subject),
    replyTo: request.restaurant_email || company?.email,
    text,
    html,
  });
  if (result?.error) {
    throw new Error(result.error.message || 'E-Mail konnte nicht versendet werden');
  }
};

const sendBookingConfirmation = async (request: any, company: any) => {
  const context = getEmailContext(request, company);
  const noun = context.isSalon ? 'Termin' : 'Reservierung';
  const intro = `Hallo ${context.guestName}, gute Nachrichten: ${context.isSalon ? 'Ihr' : 'Ihre'} ${noun.toLowerCase()} bei ${context.businessName} ist verbindlich bestätigt.`;
  await sendEmail({
    company,
    request,
    subject: `${noun} bestätigt – ${context.businessName} am ${formatDate(request.date)}`,
    text: `${intro}\n\n${context.rows.map((row) => `${row.label}: ${row.value}`).join('\n')}\n\nWir freuen uns auf Ihren Besuch!`,
    html: renderEmail({
      businessName: context.businessName,
      badge: 'Verbindlich bestätigt',
      title: `${noun} bestätigt`,
      intro,
      rows: context.rows,
      accent: '#0f8f82',
      notice: 'Dieser Termin ist jetzt fest für Sie eingetragen. Wir freuen uns auf Ihren Besuch!',
    }),
  });
};

const sendAlternativeProposal = async (
  request: any,
  company: any,
  proposedDate: string,
  proposedTime: string,
  confirmUrl: string,
) => {
  const context = getEmailContext({ ...request, date: proposedDate, time: proposedTime }, company);
  const noun = context.isSalon ? 'Termin' : 'Reservierung';
  const intro = `Hallo ${context.guestName}, der ursprünglich gewünschte Zeitpunkt passt leider nicht. ${context.businessName} bietet Ihnen gern diese Alternative an:`;
  const textRows = context.rows.map((row) => `${row.label}: ${row.value}`).join('\n');
  await sendEmail({
    company,
    request,
    subject: `Neuer Terminvorschlag von ${context.businessName}`,
    text: `${intro}\n\n${textRows}\n\nDiesen Vorschlag innerhalb von 24 Stunden bestätigen:\n${confirmUrl}`,
    html: renderEmail({
      businessName: context.businessName,
      badge: 'Neuer Vorschlag',
      title: `Passt ${context.isSalon ? 'Ihnen dieser Termin' : 'diese Zeit'}?`,
      intro,
      rows: context.rows,
      accent: '#4338ca',
      action: { href: confirmUrl, label: `${noun} verbindlich bestätigen` },
      notice:
        'Dieser Zeitpunkt ist 24 Stunden exklusiv für Sie reserviert. Danach wird er automatisch wieder freigegeben.',
    }),
  });
};

module.exports = { sendBookingConfirmation, sendAlternativeProposal, formatDate };
