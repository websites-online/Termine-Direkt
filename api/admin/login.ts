const { createAdminToken, getAdminEmail, safeEqual } = require('../_lib/admin-auth');

module.exports = async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const configuredPassword = String(process.env.ADMIN_PASSWORD || '');
  if (!configuredPassword) {
    res.status(503).json({ error: 'ADMIN_PASSWORD ist in Vercel noch nicht eingerichtet.' });
    return;
  }

  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || '');
  if (email !== getAdminEmail() || !safeEqual(password, configuredPassword)) {
    res.status(401).json({ error: 'Ungültige Zugangsdaten.' });
    return;
  }

  try {
    res.status(200).json({ token: createAdminToken(email) });
  } catch (error: any) {
    res.status(503).json({ error: error.message || 'Admin-Login ist nicht konfiguriert.' });
  }
};
