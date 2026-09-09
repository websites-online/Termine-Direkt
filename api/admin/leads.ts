const { getBearerToken, verifyAdminToken } = require('../_lib/admin-auth');

const getClient = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
};

const allowedStatuses = new Set([
  'new',
  'reviewed',
  'contacted',
  'replied',
  'no_interest',
  'customer',
  'excluded',
]);

const toLeadResponse = (row: any) => ({
  id: row.id,
  sourceKey: row.source_key,
  name: row.name,
  category: row.category,
  city: row.city,
  postcode: row.postcode || undefined,
  address: row.address || undefined,
  website: row.website || undefined,
  phone: row.phone || undefined,
  email: row.email || undefined,
  contactUrl: row.contact_url || undefined,
  sourceUrl: row.source_url || undefined,
  scanRegion: row.scan_region,
  hasBookingSystem: row.has_booking_system === true,
  bookingSystem: row.booking_system || undefined,
  bookingEvidence: row.booking_evidence || undefined,
  confidence: Number(row.confidence || 0),
  status: row.status || 'new',
  notes: row.notes || undefined,
  discoveredAt: row.discovered_at,
  lastScannedAt: row.last_scanned_at,
  contactedAt: row.contacted_at || undefined,
});

module.exports = async function handler(req: any, res: any) {
  if (!verifyAdminToken(getBearerToken(req))) {
    res.status(401).json({ error: 'Nicht autorisiert.' });
    return;
  }

  try {
    const supabase = getClient();
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('sales_leads')
        .select('*')
        .order('discovered_at', { ascending: false })
        .limit(500);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json((data || []).map(toLeadResponse));
      return;
    }

    if (req.method === 'PATCH') {
      const id = String(req.query?.id || '').trim();
      const status = String(req.body?.status || '').trim();
      const notes = String(req.body?.notes || '').trim();
      if (!id || !allowedStatuses.has(status)) {
        res.status(400).json({ error: 'Ungültige Lead-Aktualisierung.' });
        return;
      }
      const updates: Record<string, any> = {
        status,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      };
      if (status === 'contacted') {
        updates.contacted_at = new Date().toISOString();
      }
      const { data, error } = await supabase
        .from('sales_leads')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json(toLeadResponse(data));
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('admin leads error', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
