type CompanyRow = {
  slug: string;
  name: string;
  service_type?: string | null;
};

type ReservationRow = {
  restaurant_slug?: string | null;
  date?: string | null;
};

type BookingRequestRow = {
  restaurant_slug?: string | null;
  date?: string | null;
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

const parseReservationDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]) - 1;
    const day = Number(iso[3]);
    return new Date(year, month, day);
  }

  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3]);
    return new Date(year, month, day);
  }

  const named = /^(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s+(\d{4})$/.exec(text);
  if (named) {
    const monthMap: Record<string, number> = {
      januar: 0,
      februar: 1,
      maerz: 2,
      märz: 2,
      april: 3,
      mai: 4,
      juni: 5,
      juli: 6,
      august: 7,
      september: 8,
      oktober: 9,
      november: 10,
      dezember: 11
    };
    const day = Number(named[1]);
    const monthName = named[2].toLowerCase();
    const year = Number(named[3]);
    const month = monthMap[monthName];
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }

  return null;
};

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getRange = (period: string, monthParam?: string | null): { from: Date | null; to: Date | null } => {
  const now = new Date();
  if (period === 'all') {
    return { from: null, to: null };
  }
  if (period === 'last-30-days') {
    const to = startOfDay(now);
    const from = new Date(to);
    from.setDate(from.getDate() - 29);
    return { from, to };
  }
  if (period === 'month' && monthParam) {
    const m = /^(\d{4})-(\d{2})$/.exec(monthParam);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 0);
      return { from, to };
    }
  }

  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from, to };
};

const fmt = (date: Date | null): string | null => {
  if (!date) {
    return null;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isMissingTableError = (error: any, tableName: string): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    (message.includes('does not exist') && message.includes(tableName.toLowerCase()))
  );
};

module.exports = async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabase = getClient();
    const period = typeof req.query?.period === 'string' ? req.query.period : 'this-month';
    const monthParam = typeof req.query?.month === 'string' ? req.query.month : null;
    const range = getRange(period, monthParam);

    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select('slug,name,service_type')
      .order('name', { ascending: true });
    if (companiesError) {
      res.status(500).json({ error: companiesError.message });
      return;
    }

    const pageSize = 1000;
    const reservations: ReservationRow[] = [];
    let fromIndex = 0;
    while (true) {
      const { data, error } = await supabase
        .from('reservations')
        .select('restaurant_slug,date')
        .range(fromIndex, fromIndex + pageSize - 1);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      const rows = (data || []) as ReservationRow[];
      reservations.push(...rows);
      if (rows.length < pageSize) {
        break;
      }
      fromIndex += pageSize;
    }

    const bookingRequests: BookingRequestRow[] = [];
    let requestsTableAvailable = true;
    fromIndex = 0;
    while (true) {
      const { data, error } = await supabase
        .from('booking_requests')
        .select('restaurant_slug,date')
        .range(fromIndex, fromIndex + pageSize - 1);
      if (error) {
        if (isMissingTableError(error, 'booking_requests')) {
          requestsTableAvailable = false;
          break;
        }
        res.status(500).json({ error: error.message });
        return;
      }
      const rows = (data || []) as BookingRequestRow[];
      bookingRequests.push(...rows);
      if (rows.length < pageSize) {
        break;
      }
      fromIndex += pageSize;
    }

    const isInRange = (dateValue?: string | null): boolean => {
      const parsed = parseReservationDate(dateValue);
      if (!parsed) {
        return false;
      }
      const target = startOfDay(parsed);
      if (range.from && target < range.from) {
        return false;
      }
      if (range.to && target > range.to) {
        return false;
      }
      return true;
    };

    const companyMap = new Map<string, CompanyRow>();
    ((companiesData || []) as CompanyRow[]).forEach((company) => companyMap.set(company.slug, company));

    const bookingCounts = new Map<string, number>();
    reservations.forEach((row) => {
      const slug = row.restaurant_slug || '';
      if (!slug || !isInRange(row.date)) {
        return;
      }
      bookingCounts.set(slug, (bookingCounts.get(slug) || 0) + 1);
    });

    const requestCounts = new Map<string, number>();
    bookingRequests.forEach((row) => {
      const slug = row.restaurant_slug || '';
      if (!slug || !isInRange(row.date)) {
        return;
      }
      requestCounts.set(slug, (requestCounts.get(slug) || 0) + 1);
    });

    const rows = Array.from(companyMap.values())
      .map((company) => {
        const bookings = bookingCounts.get(company.slug) || 0;
        const requests = requestCounts.get(company.slug) || 0;
        return {
          slug: company.slug,
          name: company.name,
          serviceType: company.service_type || 'restaurant',
          bookings,
          requests,
          total: bookings + requests
        };
      })
      .sort((a, b) => b.total - a.total || b.bookings - a.bookings || a.name.localeCompare(b.name, 'de'));

    res.status(200).json({
      period,
      from: fmt(range.from),
      to: fmt(range.to),
      companiesTotal: companyMap.size,
      bookingsTotal: rows.reduce((sum, row) => sum + row.bookings, 0),
      requestsTotal: rows.reduce((sum, row) => sum + row.requests, 0),
      interactionsTotal: rows.reduce((sum, row) => sum + row.total, 0),
      requestsTableAvailable,
      rows
    });
  } catch (error: any) {
    console.error('admin stats api error', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
