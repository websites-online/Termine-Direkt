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
  const match = note.match(/Service:\\s*([^|]+)/i);
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
    .filter((part: string) => part.length > 0 && !/^Service:/i.test(part));
  if (parts.length === 0) {
    return undefined;
  }
  return parts
    .map((part: string) => part.replace(/^Notiz:\\s*/i, '').trim())
    .join(' | ');
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
      .select('slug,name,email,service_type,login_pin')
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
      const date = typeof req.query?.date === 'string' ? req.query.date : '';
      if (!date) {
        res.status(200).json([]);
        return;
      }

      const { data, error } = await supabase
        .from('reservations')
        .select('id,date,time,guest_name,guest_email,phone,people,note,created_at')
        .eq('restaurant_slug', company.slug)
        .eq('date', date)
        .order('time', { ascending: true });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        time: row.time,
        guestName: row.guest_name || undefined,
        guestEmail: row.guest_email || undefined,
        phone: row.phone || undefined,
        people: row.people || undefined,
        note: extractNote(row.note || null),
        service: extractService(row.note || null),
        createdAt: row.created_at
      }));

      res.status(200).json(mapped);
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.date || !body.time || !body.guestName) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const { count, error: countError } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_slug', company.slug)
        .eq('date', body.date)
        .eq('time', body.time);

      if (countError) {
        res.status(500).json({ error: countError.message });
        return;
      }
      if ((count || 0) >= 3) {
        res.status(409).json({ error: 'Slot voll' });
        return;
      }

      const noteParts = [
        body.service ? `Service: ${body.service}` : null,
        body.note ? `Notiz: ${body.note}` : null
      ].filter(Boolean);

      const { data, error } = await supabase
        .from('reservations')
        .insert({
          restaurant_slug: company.slug,
          restaurant_name: company.name,
          restaurant_email: company.email,
          guest_name: body.guestName,
          guest_email: body.guestEmail || null,
          phone: body.phone || null,
          people: body.people || null,
          note: noteParts.length > 0 ? noteParts.join(' | ') : null,
          date: body.date,
          time: body.time
        })
        .select('id,date,time,guest_name,guest_email,phone,people,note,created_at')
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({
        id: data.id,
        date: data.date,
        time: data.time,
        guestName: data.guest_name || undefined,
        guestEmail: data.guest_email || undefined,
        phone: data.phone || undefined,
        people: data.people || undefined,
        note: extractNote(data.note || null),
        service: extractService(data.note || null),
        createdAt: data.created_at
      });
      return;
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query?.id === 'string' ? req.query.id : '';
      if (!id) {
        res.status(400).json({ error: 'Missing id' });
        return;
      }

      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id)
        .eq('restaurant_slug', company.slug);

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
