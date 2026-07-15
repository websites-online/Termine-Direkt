type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  address: string;
  hours: string;
  break_hours?: string | null;
  email: string;
  service_type?: string | null;
  login_pin?: string | null;
  slot_capacity?: number | null;
  slot_interval_minutes?: number | null;
  booking_buffer_minutes?: number | null;
  time_selection_mode?: string | null;
  booking_mode?: string | null;
  seating_options_enabled?: boolean | null;
  stylist_selection_enabled?: boolean | null;
  stylists?: unknown;
  created_at: string;
};

const createSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const toCompanyResponse = (row: CompanyRow) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  address: row.address,
  hours: row.hours,
  breakHours: row.break_hours || undefined,
  email: row.email,
  serviceType: row.service_type || 'restaurant',
  slotCapacity: row.slot_capacity ?? 3,
  slotIntervalMinutes:
    row.slot_interval_minutes === 30 || row.slot_interval_minutes === 60
      ? row.slot_interval_minutes
      : 45,
  bookingBufferMinutes: normalizeBookingBufferMinutes(row.booking_buffer_minutes),
  timeSelectionMode: row.time_selection_mode === 'free' ? 'free' : 'slots',
  bookingMode: row.booking_mode || 'confirm',
  seatingOptionsEnabled: row.seating_options_enabled ?? false,
  stylistSelectionEnabled: row.service_type === 'friseur' && row.stylist_selection_enabled === true,
  stylists: row.service_type === 'friseur' ? normalizeStylists(row.stylists) : [],
  createdAt: row.created_at
});

const normalizeSlotInterval = (value: unknown): 30 | 45 | 60 => {
  const n = Number(value);
  if (n === 30 || n === 60) {
    return n;
  }
  return 45;
};

const normalizeTimeSelectionMode = (value: unknown): 'slots' | 'free' =>
  value === 'free' ? 'free' : 'slots';

const normalizeBookingBufferMinutes = (value: unknown): number => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) {
    return 120;
  }
  return Math.min(Math.max(Math.round(minutes), 0), 1440);
};

const normalizeStylists = (value: unknown): string[] => {
  const source =
    typeof value === 'string'
      ? value.split(/\r?\n|,/)
      : Array.isArray(value)
        ? value
        : [];
  return Array.from(
    new Set(
      source
        .map((item) => String(item || '').trim())
        .filter((item) => item.length > 0)
    )
  );
};

const isMissingColumnError = (error: any, columnName: string): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === 'PGRST204' ||
    (message.includes(columnName.toLowerCase()) && message.includes('column')) ||
    (message.includes('schema cache') && message.includes(columnName.toLowerCase()))
  );
};

const optionalCompanyColumns = [
  'booking_buffer_minutes',
  'stylist_selection_enabled',
  'stylists'
] as const;

const removeMissingOptionalColumns = <T extends Record<string, any>>(record: T, error: any): T => {
  const fallback = { ...record };
  optionalCompanyColumns.forEach((columnName) => {
    if (isMissingColumnError(error, columnName)) {
      delete fallback[columnName];
    }
  });
  return fallback;
};

const hasMissingOptionalColumn = (error: any): boolean =>
  optionalCompanyColumns.some((columnName) => isMissingColumnError(error, columnName));

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
  try {
    const supabase = getClient();
    const slug = typeof req.query?.slug === 'string' ? req.query.slug : undefined;

    if (req.method === 'GET') {
      if (slug) {
        const { data, error } = await supabase.from('companies').select('*').eq('slug', slug).single();
        if (error) {
          res.status(404).json({ error: 'Company not found' });
          return;
        }
        res.status(200).json(toCompanyResponse(data));
        return;
      }

      const { data, error } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json((data || []).map(toCompanyResponse));
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const serviceType = body.serviceType || 'restaurant';
      const stylists = serviceType === 'friseur' ? normalizeStylists(body.stylists) : [];
      if (!body.name || !body.address || !body.hours || !body.email) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const baseSlug = createSlug(body.name);
      let uniqueSlug = baseSlug;
      let suffix = 2;
      while (true) {
        const { data } = await supabase.from('companies').select('id').eq('slug', uniqueSlug).maybeSingle();
        if (!data) {
          break;
        }
        uniqueSlug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }

      const insert = {
        name: body.name,
        slug: uniqueSlug,
        address: body.address,
        hours: body.hours,
        break_hours: body.breakHours || null,
        email: body.email,
        service_type: serviceType,
        login_pin: body.loginPin ? String(body.loginPin).trim() : null,
        slot_capacity: typeof body.slotCapacity === 'number' ? body.slotCapacity : 3,
        slot_interval_minutes: normalizeSlotInterval(body.slotIntervalMinutes),
        booking_buffer_minutes: normalizeBookingBufferMinutes(body.bookingBufferMinutes),
        time_selection_mode: normalizeTimeSelectionMode(body.timeSelectionMode),
        booking_mode: body.bookingMode === 'request' ? 'request' : 'confirm',
        seating_options_enabled: serviceType === 'restaurant' && body.seatingOptionsEnabled === true,
        stylist_selection_enabled:
          serviceType === 'friseur' && body.stylistSelectionEnabled === true && stylists.length > 0,
        stylists
      };
      let { data, error } = await supabase.from('companies').insert(insert).select('*').single();
      if (error && hasMissingOptionalColumn(error)) {
        const fallbackInsert = removeMissingOptionalColumns(insert, error);
        const fallbackResult = await supabase.from('companies').insert(fallbackInsert).select('*').single();
        data = fallbackResult.data;
        error = fallbackResult.error;
      }
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json(toCompanyResponse(data));
      return;
    }

    if (req.method === 'PATCH') {
      if (!slug) {
        res.status(400).json({ error: 'Missing slug' });
        return;
      }
      const body = req.body || {};
      const serviceType = body.serviceType || 'restaurant';
      const stylists = serviceType === 'friseur' ? normalizeStylists(body.stylists) : [];
      if (!body.name || !body.address || !body.hours || !body.email) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const baseSlug = createSlug(body.name);
      let nextSlug = baseSlug;
      let suffix = 2;
      while (true) {
        const { data } = await supabase
          .from('companies')
          .select('id')
          .eq('slug', nextSlug)
          .neq('slug', slug)
          .maybeSingle();
        if (!data) {
          break;
        }
        nextSlug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }

      const updates: Record<string, any> = {
        name: body.name,
        slug: nextSlug,
        address: body.address,
        hours: body.hours,
        break_hours: body.breakHours || null,
        email: body.email,
        service_type: serviceType,
        booking_buffer_minutes: normalizeBookingBufferMinutes(body.bookingBufferMinutes),
        time_selection_mode: normalizeTimeSelectionMode(body.timeSelectionMode),
        booking_mode: body.bookingMode === 'request' ? 'request' : 'confirm',
        seating_options_enabled: serviceType === 'restaurant' && body.seatingOptionsEnabled === true,
        stylist_selection_enabled:
          serviceType === 'friseur' && body.stylistSelectionEnabled === true && stylists.length > 0,
        stylists
      };
      if (body.loginPin) {
        updates.login_pin = String(body.loginPin).trim();
      }
      if (typeof body.slotCapacity === 'number') {
        updates.slot_capacity = body.slotCapacity;
      }
      if (body.slotIntervalMinutes !== undefined && body.slotIntervalMinutes !== null) {
        updates.slot_interval_minutes = normalizeSlotInterval(body.slotIntervalMinutes);
      }
      let { data, error } = await supabase.from('companies').update(updates).eq('slug', slug).select('*').single();
      if (error && hasMissingOptionalColumn(error)) {
        const fallbackUpdates = removeMissingOptionalColumns(updates, error);
        const fallbackResult = await supabase.from('companies').update(fallbackUpdates).eq('slug', slug).select('*').single();
        data = fallbackResult.data;
        error = fallbackResult.error;
      }
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json(toCompanyResponse(data));
      return;
    }

    if (req.method === 'DELETE') {
      if (!slug) {
        res.status(400).json({ error: 'Missing slug' });
        return;
      }
      const { error } = await supabase.from('companies').delete().eq('slug', slug);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('companies api error', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
