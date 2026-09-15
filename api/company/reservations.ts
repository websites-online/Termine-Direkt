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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createBookingActionToken } = require('../_lib/booking-action-token');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sendBookingConfirmation, sendAlternativeProposal } = require('../_lib/booking-emails');

const platformUrl = (
  process.env.PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  'https://nextime-booking.de'
).replace(/\/+$/, '');

const parseToken = (token: string) => {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [slug, pin] = decoded.split(':');
    if (!slug || !pin) {
      return null;
    }
    return { slug, pin };
  } catch {
    return null;
  }
};

const extractService = (note: string | null) => {
  if (!note) {
    return undefined;
  }
  const match = note.match(/Service:\s*([^|]+)/i);
  if (!match) {
    return undefined;
  }
  return match[1].trim();
};

const extractStylist = (note: string | null) => {
  if (!note) {
    return undefined;
  }
  const match = note.match(/(?:Friseur|Wunsch-Friseur):\s*([^|]+)/i);
  if (!match) {
    return undefined;
  }
  return match[1].trim();
};

const extractNote = (note: string | null) => {
  if (!note) {
    return undefined;
  }
  const parts = note
    .split('|')
    .map((part: string) => part.trim())
    .filter(
      (part: string) =>
        part.length > 0 &&
        !/^__BLOCK__:/i.test(part) &&
        !/^__INTERNAL__:/i.test(part) &&
        !/^Service:/i.test(part) &&
        !/^Wunsch-Friseur:/i.test(part) &&
        !/^Friseur:/i.test(part),
    );
  if (parts.length === 0) {
    return undefined;
  }
  return parts.map((part: string) => part.replace(/^Notiz:\s*/i, '').trim()).join(' | ');
};

const extractBlockId = (note: string | null): string | undefined => {
  if (!note) {
    return undefined;
  }
  const match = note.match(/^__BLOCK__:([^|]+)/i);
  return match?.[1]?.trim() || undefined;
};

const extractInternalId = (note: string | null): string | undefined => {
  if (!note) {
    return undefined;
  }
  const match = note.match(/^__INTERNAL__:([^|]+)/i);
  return match?.[1]?.trim() || undefined;
};

const toReservationResponse = (row: any, isRequest = false) => ({
  id: row.id,
  date: row._display_date || row.date,
  time: row._display_time || row.time,
  requestedDate: isRequest ? row.date : undefined,
  requestedTime: isRequest ? row.time : undefined,
  guestName: row.guest_name || undefined,
  guestEmail: row.guest_email || undefined,
  phone: row.phone || undefined,
  people: row.people || undefined,
  note: extractNote(row.note || null),
  service: extractService(row.note || null),
  stylist: extractStylist(row.note || null),
  isBlock: Boolean(extractBlockId(row.note || null)),
  isInternal: Boolean(extractBlockId(row.note || null) || extractInternalId(row.note || null)),
  blockId: extractBlockId(row.note || null),
  isRequest,
  requestStatus: isRequest ? row.status || 'pending' : undefined,
  proposedDate: isRequest ? row.proposed_date || undefined : undefined,
  proposedTime: isRequest ? row.proposed_time || undefined : undefined,
  alternativeSentAt: isRequest ? row.alternative_sent_at || undefined : undefined,
  alternativeExpiresAt: isRequest ? row.alternative_expires_at || undefined : undefined,
  createdAt: row.created_at,
});

const isMissingTableError = (error: any, tableName: string): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    (message.includes('does not exist') && message.includes(tableName.toLowerCase()))
  );
};

const isMissingStatusColumnError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    (message.includes('status') && message.includes('column'))
  );
};

const isMissingColumnError = (error: any, columnName: string): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    (message.includes(columnName.toLowerCase()) && message.includes('column'))
  );
};

const isValidDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const toMinutes = (value: string): number => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return Number.NaN;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : Number.NaN;
};

const formatTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const addDays = (dateValue: string, amount: number): string => {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

const getDateIndex = (dateValue: string): number => {
  const [year, month, day] = dateValue.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

const getBerlinNowIndex = (): number => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((accumulator, part) => {
      if (part.type !== 'literal') {
        accumulator[part.type] = part.value;
      }
      return accumulator;
    }, {});
  const dateValue = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  return getDateIndex(dateValue) * 1440 + hour * 60 + Number(parts.minute);
};

const getBerlinToday = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const normalizeDayKey = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length < 2 ? trimmed : trimmed[0].toUpperCase() + trimmed[1].toLowerCase();
};

const parseDayList = (value: string): number[] => {
  const dayMap: Record<string, number> = { Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4, Sa: 5, So: 6 };
  const days = new Set<number>();
  for (const part of value
    .replace(/\./g, '')
    .split(',')
    .map((item) => item.trim())) {
    const range = part.match(/^([A-Za-zÄÖÜäöü]{2})\s*[–-]\s*([A-Za-zÄÖÜäöü]{2})$/);
    if (range) {
      const start = dayMap[normalizeDayKey(range[1])];
      const end = dayMap[normalizeDayKey(range[2])];
      if (start === undefined || end === undefined) {
        continue;
      }
      let cursor = start;
      for (let count = 0; count < 7; count += 1) {
        days.add(cursor);
        if (cursor === end) break;
        cursor = (cursor + 1) % 7;
      }
      continue;
    }
    const day = dayMap[normalizeDayKey(part)];
    if (day !== undefined) days.add(day);
  }
  return [...days];
};

const parseHours = (hours: string | null): Map<number, Array<{ start: number; end: number }>> => {
  const schedule = new Map<number, Array<{ start: number; end: number }>>();
  for (const segment of String(hours || '')
    .split(/[;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)) {
    const ranges = [...segment.matchAll(/(\d{1,2}(?::\d{2})?)\s*[–-]\s*(\d{1,2}(?::\d{2})?)/g)];
    if (!ranges.length) continue;
    const days = parseDayList(segment.slice(0, ranges[0].index || 0));
    const targetDays = days.length ? days : [0, 1, 2, 3, 4, 5, 6];
    for (const range of ranges) {
      const start = toMinutes(range[1].includes(':') ? range[1] : `${range[1]}:00`);
      const end = toMinutes(range[2].includes(':') ? range[2] : `${range[2]}:00`);
      if (Number.isNaN(start) || Number.isNaN(end) || start >= end) continue;
      for (const day of targetDays) {
        schedule.set(day, [...(schedule.get(day) || []), { start, end }]);
      }
    }
  }
  return schedule;
};

const parseBreaks = (value: string | null): Array<{ start: number; end: number }> =>
  [...String(value || '').matchAll(/(\d{1,2}(?::\d{2})?)\s*[–-]\s*(\d{1,2}(?::\d{2})?)/g)]
    .map((match) => ({
      start: toMinutes(match[1].includes(':') ? match[1] : `${match[1]}:00`),
      end: toMinutes(match[2].includes(':') ? match[2] : `${match[2]}:00`),
    }))
    .filter((range) => !Number.isNaN(range.start) && !Number.isNaN(range.end));

const slotsForDate = (company: any, dateValue: string): string[] => {
  const schedule = parseHours(company.hours);
  const jsDay = new Date(`${dateValue}T12:00:00Z`).getUTCDay();
  const weekday = (jsDay + 6) % 7;
  const fallback = [{ start: 9 * 60, end: 18 * 60 }];
  const ranges = schedule.size ? schedule.get(weekday) || [] : fallback;
  const breaks = parseBreaks(company.break_hours);
  const interval = [30, 45, 60].includes(Number(company.slot_interval_minutes))
    ? Number(company.slot_interval_minutes)
    : 45;
  const slots: string[] = [];
  for (const range of ranges) {
    for (let minute = range.start; minute < range.end; minute += interval) {
      if (!breaks.some((pause) => minute >= pause.start && minute < pause.end)) {
        slots.push(formatTime(minute));
      }
    }
  }
  return slots;
};

const isTimeWithinHours = (company: any, dateValue: string, timeValue: string): boolean => {
  const minute = toMinutes(timeValue);
  if (Number.isNaN(minute)) return false;
  const schedule = parseHours(company.hours);
  const jsDay = new Date(`${dateValue}T12:00:00Z`).getUTCDay();
  const weekday = (jsDay + 6) % 7;
  const ranges = schedule.size ? schedule.get(weekday) || [] : [{ start: 9 * 60, end: 18 * 60 }];
  const breaks = parseBreaks(company.break_hours);
  return (
    ranges.some((range) => minute >= range.start && minute < range.end) &&
    !breaks.some((pause) => minute >= pause.start && minute < pause.end)
  );
};

const loadOccupancy = async (
  supabase: any,
  companySlug: string,
  startDate: string,
  endDate: string,
  excludedRequestId = '',
): Promise<Map<string, number>> => {
  const [reservationsResult, holdsResult] = await Promise.all([
    supabase
      .from('reservations')
      .select('date,time')
      .eq('restaurant_slug', companySlug)
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('booking_requests')
      .select('id,proposed_date,proposed_time')
      .eq('restaurant_slug', companySlug)
      .eq('status', 'alternative_sent')
      .gt('alternative_expires_at', new Date().toISOString())
      .gte('proposed_date', startDate)
      .lte('proposed_date', endDate),
  ]);
  if (reservationsResult.error) throw new Error(reservationsResult.error.message);
  if (holdsResult.error) {
    throw new Error(
      isMissingColumnError(holdsResult.error, 'proposed_date')
        ? 'Die Supabase-Migration für Alternativtermine fehlt noch.'
        : holdsResult.error.message,
    );
  }
  const occupancy = new Map<string, number>();
  for (const row of reservationsResult.data || []) {
    const key = `${row.date}|${row.time}`;
    occupancy.set(key, (occupancy.get(key) || 0) + 1);
  }
  for (const row of holdsResult.data || []) {
    if (row.id === excludedRequestId || !row.proposed_date || !row.proposed_time) continue;
    const key = `${row.proposed_date}|${row.proposed_time}`;
    occupancy.set(key, (occupancy.get(key) || 0) + 1);
  }
  return occupancy;
};

const isSlotAvailable = async (
  supabase: any,
  company: any,
  requestId: string,
  dateValue: string,
  timeValue: string,
): Promise<boolean> => {
  if (!isTimeWithinHours(company, dateValue, timeValue)) return false;
  const occupancy = await loadOccupancy(supabase, company.slug, dateValue, dateValue, requestId);
  const capacity = typeof company.slot_capacity === 'number' ? company.slot_capacity : 3;
  return (occupancy.get(`${dateValue}|${timeValue}`) || 0) < capacity;
};

const getSuggestions = async (supabase: any, company: any, requestRow: any) => {
  const startDate = requestRow.date > getBerlinToday() ? requestRow.date : getBerlinToday();
  const endDate = addDays(startDate, 35);
  const occupancy = await loadOccupancy(supabase, company.slug, startDate, endDate, requestRow.id);
  const capacity = typeof company.slot_capacity === 'number' ? company.slot_capacity : 3;
  const buffer = Number.isFinite(Number(company.booking_buffer_minutes))
    ? Math.max(0, Math.min(1440, Number(company.booking_buffer_minutes)))
    : 120;
  const requestedMinutes = toMinutes(requestRow.time);
  const requestedIndex = Number.isNaN(requestedMinutes)
    ? 0
    : getDateIndex(requestRow.date) * 1440 + requestedMinutes + 1;
  const earliest = Math.max(getBerlinNowIndex() + buffer, requestedIndex);
  const suggestions: Array<{ date: string; time: string }> = [];
  for (let day = 0; day <= 35 && suggestions.length < 3; day += 1) {
    const dateValue = addDays(startDate, day);
    for (const time of slotsForDate(company, dateValue)) {
      const index = getDateIndex(dateValue) * 1440 + toMinutes(time);
      if (
        index >= earliest &&
        (occupancy.get(`${dateValue}|${time}`) || 0) < capacity &&
        !(dateValue === requestRow.date && time === requestRow.time)
      ) {
        suggestions.push({ date: dateValue, time });
        if (suggestions.length === 3) break;
      }
    }
  }
  return suggestions;
};

module.exports = async function handler(req: any, res: any) {
  try {
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const parsed = token ? parseToken(token) : null;
    if (!parsed) {
      res.status(401).json({ error: 'Nicht autorisiert.' });
      return;
    }

    const supabase = getClient();
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select(
        'slug,name,email,service_type,login_pin,slot_capacity,hours,break_hours,slot_interval_minutes,booking_buffer_minutes,brand_color',
      )
      .eq('slug', parsed.slug)
      .single();

    if (companyError || !company || !company.login_pin) {
      res.status(401).json({ error: 'Nicht autorisiert.' });
      return;
    }

    if (String(company.login_pin).trim() !== String(parsed.pin).trim()) {
      res.status(401).json({ error: 'Nicht autorisiert.' });
      return;
    }

    if (req.method === 'GET') {
      const action = typeof req.query?.action === 'string' ? req.query.action : '';
      if (action === 'suggestions') {
        const requestId = typeof req.query?.requestId === 'string' ? req.query.requestId : '';
        if (!requestId) {
          res.status(400).json({ error: 'Anfrage fehlt.' });
          return;
        }
        const { data: requestRow, error: requestError } = await supabase
          .from('booking_requests')
          .select('id,date,time,status')
          .eq('id', requestId)
          .eq('restaurant_slug', company.slug)
          .maybeSingle();
        if (requestError || !requestRow) {
          res.status(requestRow ? 500 : 404).json({
            error: requestError?.message || 'Anfrage nicht gefunden.',
          });
          return;
        }
        if (requestRow.status === 'approved') {
          res.status(409).json({ error: 'Diese Anfrage wurde bereits angenommen.' });
          return;
        }
        const suggestions = await getSuggestions(supabase, company, requestRow);
        res.status(200).json({ suggestions });
        return;
      }

      const date = typeof req.query?.date === 'string' ? req.query.date : '';
      const startDate = typeof req.query?.startDate === 'string' ? req.query.startDate : '';
      const endDate = typeof req.query?.endDate === 'string' ? req.query.endDate : '';
      if (!date && (!startDate || !endDate)) {
        res.status(200).json([]);
        return;
      }

      const applyDateFilter = (query: any) =>
        date ? query.eq('date', date) : query.gte('date', startDate).lte('date', endDate);

      let reservationsQuery = supabase
        .from('reservations')
        .select('id,date,time,guest_name,guest_email,phone,people,note,created_at')
        .eq('restaurant_slug', company.slug);
      reservationsQuery = applyDateFilter(reservationsQuery);

      let requestsQuery = supabase
        .from('booking_requests')
        .select(
          'id,date,time,guest_name,guest_email,phone,people,note,status,proposed_date,proposed_time,alternative_sent_at,alternative_expires_at,created_at',
        )
        .eq('restaurant_slug', company.slug);
      requestsQuery = date
        ? requestsQuery.or(`date.eq.${date},proposed_date.eq.${date}`)
        : requestsQuery.or(
            `and(date.gte.${startDate},date.lte.${endDate}),and(proposed_date.gte.${startDate},proposed_date.lte.${endDate})`,
          );

      const [reservationsResult, requestsResult] = await Promise.all([
        reservationsQuery.order('date', { ascending: true }).order('time', { ascending: true }),
        requestsQuery.order('date', { ascending: true }).order('time', { ascending: true }),
      ]);

      if (reservationsResult.error) {
        res.status(500).json({ error: reservationsResult.error.message });
        return;
      }

      let requestRows = requestsResult.data || [];
      if (requestsResult.error) {
        if (isMissingTableError(requestsResult.error, 'booking_requests')) {
          requestRows = [];
        } else if (isMissingStatusColumnError(requestsResult.error)) {
          let fallbackQuery = supabase
            .from('booking_requests')
            .select('id,date,time,guest_name,guest_email,phone,people,note,created_at')
            .eq('restaurant_slug', company.slug);
          fallbackQuery = applyDateFilter(fallbackQuery);
          const fallbackResult = await fallbackQuery
            .order('date', { ascending: true })
            .order('time', { ascending: true });
          if (fallbackResult.error) {
            res.status(500).json({ error: fallbackResult.error.message });
            return;
          }
          requestRows = fallbackResult.data || [];
        } else {
          res.status(500).json({ error: requestsResult.error.message });
          return;
        }
      }

      const seenBlocks = new Set<string>();
      const mappedReservations = (reservationsResult.data || [])
        .map((row: any) => toReservationResponse(row))
        .filter((item: any) => {
          if (!item.blockId) {
            return true;
          }
          if (seenBlocks.has(item.blockId)) {
            return false;
          }
          seenBlocks.add(item.blockId);
          return true;
        });

      const mappedRequests = requestRows
        .filter((row: any) => row.status !== 'approved')
        .map((row: any) => {
          const hasActiveAlternative =
            row.status === 'alternative_sent' &&
            row.proposed_date &&
            row.proposed_time &&
            new Date(row.alternative_expires_at || 0).getTime() > Date.now();
          return toReservationResponse(
            hasActiveAlternative
              ? {
                  ...row,
                  _display_date: row.proposed_date,
                  _display_time: row.proposed_time,
                }
              : row,
            true,
          );
        });

      const mapped = [...mappedReservations, ...mappedRequests].sort((left, right) =>
        `${left.date}-${left.time}`.localeCompare(`${right.date}-${right.time}`),
      );

      res.status(200).json(mapped);
      return;
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const requestId = String(body.id || '').trim();
      const action = String(body.action || '');
      if (!['approve', 'offer_alternative'].includes(action) || !requestId) {
        res.status(400).json({ error: 'Ungültige Anfrage-Aktion.' });
        return;
      }

      const { data: requestRow, error: requestError } = await supabase
        .from('booking_requests')
        .select(
          'id,date,time,guest_name,guest_email,phone,people,note,status,created_at,restaurant_name,restaurant_email,proposed_date,proposed_time,alternative_sent_at,alternative_expires_at,confirmation_email_sent_at',
        )
        .eq('id', requestId)
        .eq('restaurant_slug', company.slug)
        .maybeSingle();

      if (requestError) {
        res.status(500).json({
          error:
            isMissingStatusColumnError(requestError) ||
            isMissingColumnError(requestError, 'proposed_date')
              ? 'Die Supabase-Migration für bestätigte Anfragen fehlt noch.'
              : requestError.message,
        });
        return;
      }
      if (!requestRow) {
        res.status(404).json({ error: 'Anfrage nicht gefunden.' });
        return;
      }

      if (action === 'offer_alternative') {
        if (requestRow.status === 'approved') {
          res.status(409).json({ error: 'Diese Anfrage wurde bereits angenommen.' });
          return;
        }
        const proposedDate = String(body.date || '').trim();
        const proposedTime = String(body.time || '').trim();
        if (!isValidDate(proposedDate) || Number.isNaN(toMinutes(proposedTime))) {
          res.status(400).json({ error: 'Bitte ein gültiges Datum und eine Uhrzeit wählen.' });
          return;
        }
        const proposedIndex = getDateIndex(proposedDate) * 1440 + toMinutes(proposedTime);
        if (proposedIndex <= getBerlinNowIndex()) {
          res.status(400).json({ error: 'Der Alternativtermin muss in der Zukunft liegen.' });
          return;
        }
        if (!(await isSlotAvailable(supabase, company, requestId, proposedDate, proposedTime))) {
          res.status(409).json({
            error: 'Diese Uhrzeit ist nicht verfügbar oder liegt außerhalb der Öffnungszeiten.',
          });
          return;
        }
        if (!requestRow.guest_email) {
          res.status(400).json({ error: 'Für diese Anfrage ist keine Kunden-E-Mail hinterlegt.' });
          return;
        }

        const sentAt = new Date();
        const expiresAt = new Date(sentAt.getTime() + 24 * 60 * 60 * 1000);
        const token = createBookingActionToken(
          requestId,
          'confirm-alternative',
          expiresAt.getTime(),
          { proposedDate, proposedTime, sentAt: sentAt.toISOString() },
        );
        const confirmUrl = `${platformUrl}/api/booking-requests/confirm-alternative?token=${encodeURIComponent(token)}`;
        const update = {
          status: 'alternative_sent',
          proposed_date: proposedDate,
          proposed_time: proposedTime,
          alternative_sent_at: sentAt.toISOString(),
          alternative_expires_at: expiresAt.toISOString(),
        };
        const { error: updateError } = await supabase
          .from('booking_requests')
          .update(update)
          .eq('id', requestId)
          .eq('restaurant_slug', company.slug);
        if (updateError) {
          res.status(500).json({
            error: isMissingColumnError(updateError, 'proposed_date')
              ? 'Die Supabase-Migration für Alternativtermine fehlt noch.'
              : updateError.message,
          });
          return;
        }

        try {
          await sendAlternativeProposal(
            requestRow,
            company,
            proposedDate,
            proposedTime,
            confirmUrl,
          );
        } catch (emailError: any) {
          await supabase
            .from('booking_requests')
            .update({
              status: requestRow.status || 'pending',
              proposed_date: requestRow.proposed_date,
              proposed_time: requestRow.proposed_time,
              alternative_sent_at: requestRow.alternative_sent_at,
              alternative_expires_at: requestRow.alternative_expires_at,
            })
            .eq('id', requestId)
            .eq('restaurant_slug', company.slug);
          res.status(502).json({
            error: `Die Alternative wurde nicht gespeichert, weil die E-Mail nicht versendet werden konnte: ${emailError.message}`,
          });
          return;
        }

        res.status(200).json(toReservationResponse({ ...requestRow, ...update }, true));
        return;
      }

      const reservationFields = 'id,date,time,guest_name,guest_email,phone,people,note,created_at';
      const existingResult = await supabase
        .from('reservations')
        .select(reservationFields)
        .eq('booking_request_id', requestId)
        .maybeSingle();

      if (existingResult.error) {
        res.status(500).json({
          error: isMissingColumnError(existingResult.error, 'booking_request_id')
            ? 'Die Supabase-Migration für bestätigte Anfragen fehlt noch.'
            : existingResult.error.message,
        });
        return;
      }

      let reservation = existingResult.data;
      if (!reservation) {
        const occupancy = await loadOccupancy(
          supabase,
          company.slug,
          requestRow.date,
          requestRow.date,
          requestId,
        );
        const slotCapacity = typeof company.slot_capacity === 'number' ? company.slot_capacity : 3;
        if ((occupancy.get(`${requestRow.date}|${requestRow.time}`) || 0) >= slotCapacity) {
          res.status(409).json({
            error: 'Diese Uhrzeit ist inzwischen belegt. Bitte eine Alternative anbieten.',
          });
          return;
        }

        const insertResult = await supabase
          .from('reservations')
          .insert({
            restaurant_slug: company.slug,
            restaurant_name: requestRow.restaurant_name || company.name,
            restaurant_email: requestRow.restaurant_email || company.email,
            guest_name: requestRow.guest_name,
            guest_email: requestRow.guest_email,
            phone: requestRow.phone,
            people: requestRow.people,
            note: requestRow.note,
            date: requestRow.date,
            time: requestRow.time,
            booking_request_id: requestId,
          })
          .select(reservationFields)
          .single();
        if (insertResult.error || !insertResult.data) {
          res.status(500).json({
            error: isMissingColumnError(insertResult.error, 'booking_request_id')
              ? 'Die Supabase-Migration für bestätigte Anfragen fehlt noch.'
              : insertResult.error?.message || 'Termin konnte nicht gespeichert werden.',
          });
          return;
        }
        reservation = insertResult.data;
      }

      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('restaurant_slug', company.slug);
      if (updateError) {
        if (!existingResult.data) {
          await supabase.from('reservations').delete().eq('booking_request_id', requestId);
        }
        res.status(500).json({ error: 'Anfrage konnte nicht vollständig übernommen werden.' });
        return;
      }

      let confirmationEmailSent = Boolean(requestRow.confirmation_email_sent_at);
      if (!confirmationEmailSent) {
        try {
          await sendBookingConfirmation(requestRow, company);
          confirmationEmailSent = true;
          await supabase
            .from('booking_requests')
            .update({ confirmation_email_sent_at: new Date().toISOString() })
            .eq('id', requestId);
        } catch (emailError) {
          console.error('automatic confirmation email failed', emailError);
        }
      }

      res.status(200).json({
        ...toReservationResponse(reservation),
        confirmationEmailSent,
        warning: confirmationEmailSent
          ? undefined
          : 'Der Termin wurde gespeichert, aber die Bestätigungs-E-Mail konnte nicht versendet werden.',
      });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.date || !body.time || !body.guestName) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const occupancy = await loadOccupancy(supabase, company.slug, body.date, body.date);
      const occupiedCount = occupancy.get(`${body.date}|${body.time}`) || 0;
      const slotCapacity = typeof company.slot_capacity === 'number' ? company.slot_capacity : 3;
      if (occupiedCount >= slotCapacity) {
        res.status(409).json({ error: 'Slot voll' });
        return;
      }

      const isBlock = body.isBlock === true;
      const blockId = isBlock ? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : '';
      const internalId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const noteParts = [
        isBlock ? `__BLOCK__:${blockId}` : `__INTERNAL__:${internalId}`,
        body.service ? `Service: ${body.service}` : null,
        body.stylist ? `Friseur: ${body.stylist}` : null,
        body.note ? `Notiz: ${body.note}` : null,
      ].filter(Boolean);

      const record = {
        restaurant_slug: company.slug,
        restaurant_name: company.name,
        restaurant_email: company.email,
        guest_name: isBlock ? 'Sperrzeit' : body.guestName,
        guest_email: isBlock ? null : body.guestEmail || null,
        phone: isBlock ? null : body.phone || null,
        people: isBlock ? null : body.people || null,
        note: noteParts.length > 0 ? noteParts.join(' | ') : null,
        date: body.date,
        time: body.time,
      };
      const recordsToInsert = isBlock
        ? Array.from({ length: Math.max(slotCapacity - occupiedCount, 1) }, () => ({ ...record }))
        : [record];

      const { data, error } = await supabase
        .from('reservations')
        .insert(recordsToInsert)
        .select('id,date,time,guest_name,guest_email,phone,people,note,created_at');

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      if (!data?.[0]) {
        res.status(500).json({ error: 'Sperrzeit oder Termin konnte nicht gespeichert werden.' });
        return;
      }

      res.status(200).json(toReservationResponse(data[0]));
      return;
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query?.id === 'string' ? req.query.id : '';
      if (!id) {
        res.status(400).json({ error: 'Missing id' });
        return;
      }

      const { data: target } = await supabase
        .from('reservations')
        .select('id,note')
        .eq('id', id)
        .eq('restaurant_slug', company.slug)
        .maybeSingle();

      let deleteQuery = supabase.from('reservations').delete().eq('restaurant_slug', company.slug);
      deleteQuery = extractBlockId(target?.note || null)
        ? deleteQuery.eq('note', target.note)
        : deleteQuery.eq('id', id);
      const { error } = await deleteQuery;

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ success: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('company reservations error', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
