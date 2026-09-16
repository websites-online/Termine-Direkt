type BookingAction = 'approve' | 'reject';

type ParsedBookingAction = {
  action: BookingAction;
  requestId: string;
};

const DEFAULT_RECEIVING_DOMAIN = 'entoutri.resend.app';

const getReceivingDomain = (): string =>
  String(process.env.RESEND_RECEIVING_DOMAIN || DEFAULT_RECEIVING_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/^@/, '');

const getActionSecret = (): string => String(process.env.BOOKING_ACTION_SECRET || '').trim();

const compactUuid = (value: string): string => {
  const compact = value.trim().toLowerCase().replace(/-/g, '');
  return /^[a-f0-9]{32}$/.test(compact) ? compact : '';
};

const expandUuid = (value: string): string =>
  `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(
    16,
    20,
  )}-${value.slice(20)}`;

const signAction = (action: BookingAction, requestId: string): string => {
  const secret = getActionSecret();
  if (!secret) {
    return '';
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto');
  return crypto
    .createHmac('sha256', secret)
    .update(`inbound-booking:${action}:${requestId}`)
    .digest()
    .subarray(0, 16)
    .toString('base64url');
};

const signaturesMatch = (left: string, right: string): boolean => {
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
  } catch {
    return false;
  }
};

const createInboundBookingAddress = (requestId: string, action: BookingAction): string => {
  const compactId = compactUuid(requestId);
  const domain = getReceivingDomain();
  if (!compactId || !domain) {
    return '';
  }
  const normalizedId = expandUuid(compactId);
  const signature = signAction(action, normalizedId);
  if (!signature) {
    return '';
  }
  const prefix = action === 'approve' ? 'a' : 'r';
  return `${prefix}-${compactId}-${signature}@${domain}`;
};

const normalizeAddress = (value: unknown): string => {
  const text = String(value || '').trim();
  const angleMatch = /<([^<>]+)>$/.exec(text);
  return String(angleMatch?.[1] || text).trim();
};

const parseInboundBookingAddress = (value: unknown): ParsedBookingAction | null => {
  const address = normalizeAddress(value);
  const atIndex = address.lastIndexOf('@');
  if (atIndex <= 0 || address.slice(atIndex + 1).toLowerCase() !== getReceivingDomain()) {
    return null;
  }
  const localPart = address.slice(0, atIndex);
  const match = /^([ar])-([a-f0-9]{32})-([a-z0-9_-]{22})$/i.exec(localPart);
  if (!match) {
    return null;
  }
  const action: BookingAction = match[1].toLowerCase() === 'a' ? 'approve' : 'reject';
  const requestId = expandUuid(match[2].toLowerCase());
  const expectedSignature = signAction(action, requestId);
  if (!signaturesMatch(match[3], expectedSignature)) {
    return null;
  }
  return { action, requestId };
};

module.exports = {
  createInboundBookingAddress,
  getReceivingDomain,
  parseInboundBookingAddress,
};
