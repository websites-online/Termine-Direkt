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

const isValidEndpoint = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length < 12 || value.length > 4096) {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const handlePushSubscriptions = async (req: any, res: any) => {
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = String(req.headers?.authorization || '');
  const parsed = authHeader.startsWith('Bearer ')
    ? parseToken(authHeader.slice('Bearer '.length))
    : null;
  if (!parsed) {
    res.status(401).json({ error: 'Nicht autorisiert.' });
    return;
  }

  const supabase = getClient();
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('slug,login_pin,plan_tier')
    .eq('slug', parsed.slug)
    .maybeSingle();

  if (
    companyError ||
    !company?.login_pin ||
    String(company.login_pin).trim() !== String(parsed.pin).trim()
  ) {
    res.status(401).json({ error: 'Nicht autorisiert.' });
    return;
  }
  if (company.plan_tier !== 'pro') {
    res.status(403).json({ error: 'Push-Benachrichtigungen sind in PRO verfügbar.' });
    return;
  }

  const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  if (req.method === 'GET') {
    res.status(200).json({
      configured: Boolean(publicKey && privateKey),
      publicKey: publicKey || null,
    });
    return;
  }

  const subscription = req.body?.subscription || req.body || {};
  const endpoint = subscription.endpoint;
  if (!isValidEndpoint(endpoint)) {
    res.status(400).json({ error: 'Ungültiges Push-Gerät.' });
    return;
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('company_push_subscriptions')
      .delete()
      .eq('company_slug', company.slug)
      .eq('endpoint', endpoint);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ success: true });
    return;
  }

  if (!publicKey || !privateKey) {
    res.status(503).json({ error: 'Push-Benachrichtigungen sind noch nicht eingerichtet.' });
    return;
  }
  const p256dh = String(subscription.keys?.p256dh || '').trim();
  const auth = String(subscription.keys?.auth || '').trim();
  if (!p256dh || !auth || p256dh.length > 1024 || auth.length > 1024) {
    res.status(400).json({ error: 'Push-Schlüssel fehlen.' });
    return;
  }

  const { error } = await supabase.from('company_push_subscriptions').upsert(
    {
      company_slug: company.slug,
      endpoint,
      p256dh,
      auth,
      user_agent: String(req.headers?.['user-agent'] || '').slice(0, 500) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ success: true });
};

module.exports = async function handler(req: any, res: any) {
  if (req.query?.resource === 'push') {
    try {
      await handlePushSubscriptions(req, res);
    } catch (error: any) {
      console.error('push subscription api error', error);
      res.status(500).json({ error: error.message || 'Server error' });
    }
    return;
  }

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
      .select('*')
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
        serviceType: data.service_type || 'restaurant',
        planTier: data.plan_tier === 'pro' ? 'pro' : 'starter',
      },
    });
  } catch (error: any) {
    console.error('company login error', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
