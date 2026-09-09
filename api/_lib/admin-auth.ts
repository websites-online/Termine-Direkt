const nodeCrypto = require('node:crypto');

const getAdminEmail = (): string =>
  String(process.env.ADMIN_EMAIL || 'webdesignodobasic@gmail.com')
    .trim()
    .toLowerCase();

const getSessionSecret = (): string =>
  String(process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length && nodeCrypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const createAdminToken = (email: string): string => {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET fehlt.');
  }
  const payload = Buffer.from(
    JSON.stringify({ email: email.toLowerCase(), exp: Date.now() + 12 * 60 * 60 * 1000 }),
  ).toString('base64url');
  const signature = nodeCrypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const verifyAdminToken = (token: string): boolean => {
  const secret = getSessionSecret();
  const [payload, signature] = String(token || '').split('.');
  if (!secret || !payload || !signature) {
    return false;
  }
  const expected = nodeCrypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) {
    return false;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed?.email === getAdminEmail() && Number(parsed?.exp) > Date.now();
  } catch {
    return false;
  }
};

const getBearerToken = (req: any): string => {
  const header = String(req.headers?.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7) : '';
};

module.exports = {
  createAdminToken,
  getAdminEmail,
  getBearerToken,
  safeEqual,
  verifyAdminToken,
};
