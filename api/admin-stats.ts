import {
  AdminStatsReservation as ReservationRow, AdminStatsRequest as BookingRequestRow,
  buildAdminStats, collectAdminStatsActivities,
} from '../src/app/shared/admin-statistics';

type CompanyRow = {
  slug: string;
  name: string;
  service_type?: string | null;
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

module.exports = async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabase = getClient();
    const period = typeof req.query?.period === 'string' ? req.query.period : 'this-month';
    const monthParam = typeof req.query?.month === 'string' ? req.query.month : null;

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
        .select('restaurant_slug,guest_email,note,booking_request_id,created_at')
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
      let requestResult = await supabase
        .from('booking_requests')
        .select('id,restaurant_slug,status,created_at')
        .range(fromIndex, fromIndex + pageSize - 1);
      if (requestResult.error && isMissingStatusColumnError(requestResult.error)) {
        requestResult = await supabase
          .from('booking_requests')
          .select('id,restaurant_slug,created_at')
          .range(fromIndex, fromIndex + pageSize - 1);
      }
      const { data, error } = requestResult;
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

    const companies = ((companiesData || []) as CompanyRow[]).map(company => ({
      slug: company.slug,
      name: company.name,
      serviceType: company.service_type === 'friseur' ? 'friseur' as const : 'restaurant' as const,
    }));
    const stats = buildAdminStats(companies, collectAdminStatsActivities(reservations, bookingRequests), period, monthParam);
    res.status(200).json({ ...stats, requestsTableAvailable });
  } catch (error: any) {
    console.error('admin stats api error', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
