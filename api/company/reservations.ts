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

const toReservationResponse = (row: any) => ({
  id: row.id,
  date: row.date,
  time: row.time,
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
  createdAt: row.created_at,
});

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
      .select('slug,name,email,service_type,login_pin,slot_capacity')
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
      const startDate = typeof req.query?.startDate === 'string' ? req.query.startDate : '';
      const endDate = typeof req.query?.endDate === 'string' ? req.query.endDate : '';
      if (!date && (!startDate || !endDate)) {
        res.status(200).json([]);
        return;
      }

      let query = supabase
        .from('reservations')
        .select('id,date,time,guest_name,guest_email,phone,people,note,created_at')
        .eq('restaurant_slug', company.slug);
      query = date ? query.eq('date', date) : query.gte('date', startDate).lte('date', endDate);
      const { data, error } = await query
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      const seenBlocks = new Set<string>();
      const mapped = (data || []).map(toReservationResponse).filter((item: any) => {
        if (!item.blockId) {
          return true;
        }
        if (seenBlocks.has(item.blockId)) {
          return false;
        }
        seenBlocks.add(item.blockId);
        return true;
      });

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
      const slotCapacity = typeof company.slot_capacity === 'number' ? company.slot_capacity : 3;
      if ((count || 0) >= slotCapacity) {
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
        ? Array.from({ length: Math.max(slotCapacity - (count || 0), 1) }, () => ({ ...record }))
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
