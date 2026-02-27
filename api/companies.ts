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
  createdAt: row.created_at
});

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
        service_type: body.serviceType || 'restaurant',
        login_pin: body.loginPin ? String(body.loginPin).trim() : null
      };
      const { data, error } = await supabase.from('companies').insert(insert).select('*').single();
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
        service_type: body.serviceType || 'restaurant'
      };
      if (body.loginPin) {
        updates.login_pin = String(body.loginPin).trim();
      }
      const { data, error } = await supabase.from('companies').update(updates).eq('slug', slug).select('*').single();
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
