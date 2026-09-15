type BookingAction = 'approve' | 'confirm-alternative';
type BookingActionClaims = {
  proposedDate?: string;
  proposedTime?: string;
  sentAt?: string;
};

const getSecret = (): string => {
  const secret = process.env.BOOKING_ACTION_SECRET?.trim();
  if (!secret) {
    throw new Error('Missing BOOKING_ACTION_SECRET');
  }
  return secret;
};

const fromBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
};

const signaturesMatch = (left: string, right: string): boolean => {
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
  } catch {
    return false;
  }
};

const createBookingActionToken = (
  requestId: string,
  action: BookingAction,
  expiresAt: number,
  claims: BookingActionClaims = {},
): string => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto');
  const payloadPart = Buffer.from(
    JSON.stringify({ requestId, action, exp: expiresAt, ...claims }),
    'utf8',
  )
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const signature = crypto.createHmac('sha256', getSecret()).update(payloadPart).digest('hex');
  return `${payloadPart}.${signature}`;
};

const verifyBookingActionToken = (
  token: string,
  expectedAction: BookingAction,
): ({ requestId: string; exp: number } & BookingActionClaims) | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return null;
    }
    const [payloadPart, signature] = parts;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', getSecret())
      .update(payloadPart)
      .digest('hex');
    if (!signaturesMatch(signature, expectedSignature)) {
      return null;
    }

    const payload = JSON.parse(fromBase64Url(payloadPart));
    if (!payload?.requestId || !payload?.exp || Date.now() > Number(payload.exp)) {
      return null;
    }

    // Alte Annehmen-Links enthielten noch keine action. Sie bleiben bewusst gültig.
    if (payload.action && payload.action !== expectedAction) {
      return null;
    }
    if (!payload.action && expectedAction !== 'approve') {
      return null;
    }
    return {
      requestId: String(payload.requestId),
      exp: Number(payload.exp),
      proposedDate: payload.proposedDate ? String(payload.proposedDate) : undefined,
      proposedTime: payload.proposedTime ? String(payload.proposedTime) : undefined,
      sentAt: payload.sentAt ? String(payload.sentAt) : undefined,
    };
  } catch {
    return null;
  }
};

module.exports = { createBookingActionToken, verifyBookingActionToken };
