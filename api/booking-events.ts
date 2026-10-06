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

const isMissingEventsTable = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    (message.includes('does not exist') && message.includes('booking_events'))
  );
};

module.exports = async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const companySlug = String(body.companySlug || '')
      .trim()
      .toLowerCase();
    const eventType = String(body.eventType || '').trim();
    const sessionId = String(body.sessionId || '').trim();
    if (!/^[a-z0-9-]{2,120}$/.test(companySlug)) {
      res.status(400).json({ error: 'Ungültiges Unternehmen.' });
      return;
    }
    if (!['page_view', 'booking_started'].includes(eventType)) {
      res.status(400).json({ error: 'Ungültiges Ereignis.' });
      return;
    }
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(sessionId)) {
      res.status(400).json({ error: 'Ungültige Sitzung.' });
      return;
    }
    const userAgent = String(req.headers?.['user-agent'] || '');
    if (/bot|crawler|spider|headless|preview/i.test(userAgent)) {
      res.status(204).end();
      return;
    }

    const supabase = getClient();
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('slug')
      .eq('slug', companySlug)
      .maybeSingle();
    if (companyError || !company) {
      res.status(404).json({ error: 'Unternehmen nicht gefunden.' });
      return;
    }

    const { error } = await supabase.from('booking_events').upsert(
      {
        company_slug: companySlug,
        event_type: eventType,
        session_id: sessionId,
      },
      { onConflict: 'company_slug,event_type,session_id', ignoreDuplicates: true },
    );
    if (error) {
      if (isMissingEventsTable(error)) {
        res.status(202).json({ tracked: false });
        return;
      }
      throw error;
    }
    res.status(204).end();
  } catch (error: any) {
    console.error('booking event api error', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
