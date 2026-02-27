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
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, message: 'Use POST /api/company/login' });
    return;
  }

  try {
    const { slug, pin } = req.body || {};
    if (!slug || !pin) {
      res.status(400).json({ error: 'Missing login credentials' });
      return;
    }

    const supabase = getClient();
    const { data, error } = await supabase
      .from('companies')
      .select('slug,name,email,service_type,login_pin')
      .or(`slug.eq.${slug},name.eq.${slug}`)
      .single();

    if (error || !data) {
      res.status(401).json({ error: 'Ungültige Zugangsdaten.' });
      return;
    }

    if (!data.login_pin) {
      res.status(403).json({ error: 'Login noch nicht aktiviert.' });
      return;
    }

    if (String(data.login_pin).trim() !== String(pin).trim()) {
      res.status(401).json({ error: 'Ungültige Zugangsdaten.' });
      return;
    }

    const token = Buffer.from(`${data.slug}:${String(pin).trim()}`).toString('base64');

    res.status(200).json({
      token,
      company: {
        token,
        slug: data.slug,
        name: data.name,
        email: data.email,
        serviceType: data.service_type || 'restaurant'
      }
    });
  } catch (error: any) {
    console.error('company login error', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
