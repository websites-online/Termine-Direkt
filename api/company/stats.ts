type StatsPeriod = 30 | 90 | 365;

type ActivityRow = {
  date?: string | null;
  time?: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  phone?: string | null;
  note?: string | null;
  created_at?: string | null;
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

const parseToken = (token: string) => {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [slug, pin] = decoded.split(':');
    return slug && pin ? { slug, pin } : null;
  } catch {
    return null;
  }
};

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isInternalEntry = (note?: string | null): boolean =>
  /^__(?:BLOCK|INTERNAL)__:/i.test(String(note || '').trim());

const normalizeIdentity = (row: ActivityRow): string => {
  const email = String(row.guest_email || '')
    .trim()
    .toLowerCase();
  if (email) {
    return `email:${email}`;
  }
  const phone = String(row.phone || '').replace(/\D/g, '');
  if (phone) {
    return `phone:${phone}`;
  }
  const name = String(row.guest_name || '')
    .trim()
    .toLocaleLowerCase('de');
  return name ? `name:${name}` : '';
};

const displayCustomerName = (row: ActivityRow): string => {
  const name = String(row.guest_name || '').trim();
  if (name) {
    return name;
  }
  const email = String(row.guest_email || '').trim();
  return email ? email.split('@')[0] : 'Unbekannter Kunde';
};

const getChangePercent = (current: number, previous: number): number | null => {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 100);
};

const getStrongest = <T extends { count: number }>(items: T[]): T =>
  items.reduce((best, item) => (item.count > best.count ? item : best), items[0]);

const fetchAllRows = async (supabase: any, table: string, slug: string) => {
  const rows: ActivityRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('date,time,guest_name,guest_email,phone,note,created_at')
      .eq('restaurant_slug', slug)
      .range(from, from + pageSize - 1);
    if (error) {
      throw error;
    }
    const page = (data || []) as ActivityRow[];
    rows.push(...page);
    if (page.length < pageSize) {
      break;
    }
    from += pageSize;
  }
  return rows;
};

module.exports = async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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
      .select('*')
      .eq('slug', parsed.slug)
      .single();

    if (
      companyError ||
      !company?.login_pin ||
      String(company.login_pin).trim() !== String(parsed.pin).trim()
    ) {
      res.status(401).json({ error: 'Nicht autorisiert.' });
      return;
    }

    if (company.plan_tier !== 'pro') {
      res.status(403).json({
        error: 'Die ausführliche Statistik ist in der PRO-Version verfügbar.',
        upgradeRequired: true,
      });
      return;
    }

    const requestedPeriod = Number(req.query?.period);
    const period: StatsPeriod =
      requestedPeriod === 90 || requestedPeriod === 365 ? requestedPeriod : 30;
    const to = startOfDay(new Date());
    const from = addDays(to, -(period - 1));
    const previousTo = addDays(from, -1);
    const previousFrom = addDays(previousTo, -(period - 1));
    const requestMode = company.booking_mode === 'request';
    const allRows = await fetchAllRows(
      supabase,
      requestMode ? 'booking_requests' : 'reservations',
      company.slug,
    );
    const eligibleRows = requestMode
      ? allRows
      : allRows.filter((row) => !isInternalEntry(row.note));

    const within = (row: ActivityRow, rangeFrom: Date, rangeTo: Date): boolean => {
      const date = parseDate(row.date);
      return Boolean(date && date >= rangeFrom && date <= rangeTo);
    };
    const currentRows = eligibleRows.filter((row) => within(row, from, to));
    const previousRows = eligibleRows.filter((row) => within(row, previousFrom, previousTo));

    const weekdayLabels = [
      'Sonntag',
      'Montag',
      'Dienstag',
      'Mittwoch',
      'Donnerstag',
      'Freitag',
      'Samstag',
    ];
    const weekdayShortLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const weekdays = weekdayLabels.map((label, index) => ({
      label,
      shortLabel: weekdayShortLabels[index],
      count: currentRows.filter((row) => parseDate(row.date)?.getDay() === index).length,
    }));

    const timeRanges = [
      { label: 'Vor 10 Uhr', shortLabel: '< 10', from: 0, to: 10 },
      { label: '10–13 Uhr', shortLabel: '10–13', from: 10, to: 13 },
      { label: '13–16 Uhr', shortLabel: '13–16', from: 13, to: 16 },
      { label: '16–19 Uhr', shortLabel: '16–19', from: 16, to: 19 },
      { label: 'Ab 19 Uhr', shortLabel: '19+', from: 19, to: 24 },
    ].map((range) => ({
      label: range.label,
      shortLabel: range.shortLabel,
      count: currentRows.filter((row) => {
        const hour = Number(String(row.time || '').split(':')[0]);
        return Number.isFinite(hour) && hour >= range.from && hour < range.to;
      }).length,
    }));

    const monthPhases = [
      { label: 'Monatsanfang', detail: '1.–10.', from: 1, to: 10 },
      { label: 'Monatsmitte', detail: '11.–20.', from: 11, to: 20 },
      { label: 'Monatsende', detail: 'ab 21.', from: 21, to: 31 },
    ].map((phase) => ({
      label: phase.label,
      detail: phase.detail,
      count: currentRows.filter((row) => {
        const day = parseDate(row.date)?.getDate() || 0;
        return day >= phase.from && day <= phase.to;
      }).length,
    }));

    const customerMap = new Map<string, { name: string; count: number; lastDate: string }>();
    currentRows.forEach((row) => {
      const identity = normalizeIdentity(row);
      if (!identity) {
        return;
      }
      const date = String(row.date || '');
      const customer = customerMap.get(identity);
      if (customer) {
        customer.count += 1;
        customer.lastDate = date > customer.lastDate ? date : customer.lastDate;
      } else {
        customerMap.set(identity, { name: displayCustomerName(row), count: 1, lastDate: date });
      }
    });
    const customers = Array.from(customerMap.values()).sort(
      (left, right) => right.count - left.count || right.lastDate.localeCompare(left.lastDate),
    );
    const returningCustomers = customers.filter((customer) => customer.count > 1).length;

    const leadTimes = currentRows
      .map((row) => {
        const appointment = parseDate(row.date);
        const created = row.created_at ? new Date(row.created_at) : null;
        if (!appointment || !created || Number.isNaN(created.getTime())) {
          return null;
        }
        const days = Math.floor(
          (appointment.getTime() - startOfDay(created).getTime()) / 86_400_000,
        );
        return days >= 0 ? days : null;
      })
      .filter((days): days is number => days !== null);

    const bucketCount = period === 30 ? 10 : 12;
    const bucketDays = Math.ceil(period / bucketCount);
    const trend = Array.from({ length: bucketCount }, (_, index) => {
      const bucketFrom = addDays(from, index * bucketDays);
      const bucketTo = index === bucketCount - 1 ? to : addDays(bucketFrom, bucketDays - 1);
      return {
        label: new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(
          bucketFrom,
        ),
        fullLabel: `${new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(bucketFrom)} – ${new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(bucketTo)}`,
        count: currentRows.filter((row) => within(row, bucketFrom, bucketTo)).length,
      };
    });

    const bestWeekday = getStrongest(weekdays);
    const bestTime = getStrongest(timeRanges);
    const strongestPhase = getStrongest(monthPhases);

    res.status(200).json({
      period,
      from: formatDate(from),
      to: formatDate(to),
      companyName: company.name,
      eventKind: requestMode ? 'request' : 'booking',
      eventLabel: requestMode ? 'Anfragen' : 'Buchungen',
      total: currentRows.length,
      previousTotal: previousRows.length,
      changePercent: getChangePercent(currentRows.length, previousRows.length),
      uniqueCustomers: customers.length,
      returningCustomers,
      returningRate:
        customers.length > 0 ? Math.round((returningCustomers / customers.length) * 100) : 0,
      averageLeadDays:
        leadTimes.length > 0
          ? Math.round((leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length) * 10) /
            10
          : null,
      bestWeekday,
      bestTime,
      strongestPhase,
      trend,
      weekdays,
      timeRanges,
      monthPhases,
      topCustomers: customers.slice(0, 5),
    });
  } catch (error: any) {
    console.error('company stats error', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
