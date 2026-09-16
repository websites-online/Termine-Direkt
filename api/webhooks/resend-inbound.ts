// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Webhook } = require('svix');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  getAvailableEmployees,
  getServiceDuration,
  isEmployeeCalendar,
} = require('../_lib/employee-calendar');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseInboundBookingAddress } = require('../_lib/inbound-booking-action');

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

const getHeader = (req: any, name: string): string => {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
};

const getRawPayload = (body: unknown): string | Buffer => {
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (typeof body === 'string') {
    return body;
  }
  return JSON.stringify(body || {});
};

const asAddressList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '')).filter(Boolean);
  }
  return value ? [String(value)] : [];
};

const extractFromNote = (note: unknown, key: string): string => {
  const match = String(note || '').match(new RegExp(`${key}:\\s*([^|]+)`, 'i'));
  return match?.[1]?.trim() || '';
};

const isMissingColumnError = (error: any, columnName: string): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    (message.includes(columnName.toLowerCase()) && message.includes('column'))
  );
};

const updateRequestStatus = async (
  supabase: any,
  requestId: string,
  status: 'approved' | 'rejected',
): Promise<void> => {
  const values: Record<string, unknown> = { status };
  if (status === 'approved') {
    values.approved_at = new Date().toISOString();
  }
  let result = await supabase.from('booking_requests').update(values).eq('id', requestId);
  if (result.error && status === 'approved' && isMissingColumnError(result.error, 'approved_at')) {
    result = await supabase
      .from('booking_requests')
      .update({ status: 'approved' })
      .eq('id', requestId);
  }
  if (result.error) {
    throw result.error;
  }
};

const loadRequest = async (supabase: any, requestId: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from('booking_requests')
    .select(
      'id,restaurant_slug,restaurant_name,restaurant_email,guest_name,guest_email,phone,people,note,date,time,status,employee_id,duration_minutes,created_at',
    )
    .eq('id', requestId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data || null;
};

const loadCompany = async (supabase: any, requestRow: any): Promise<any> => {
  const extendedResult = await supabase
    .from('companies')
    .select(
      'slug,name,email,service_type,slot_capacity,slot_interval_minutes,plan_tier,calendar_mode,employees,salon_services,hours,break_hours',
    )
    .eq('slug', requestRow.restaurant_slug)
    .maybeSingle();
  if (!extendedResult.error && extendedResult.data) {
    return extendedResult.data;
  }

  const basicResult = await supabase
    .from('companies')
    .select('slug,name,email,service_type,slot_capacity')
    .eq('slug', requestRow.restaurant_slug)
    .maybeSingle();
  if (basicResult.error) {
    throw basicResult.error;
  }
  if (basicResult.data) {
    return {
      ...basicResult.data,
      slot_interval_minutes: 45,
      plan_tier: 'basic',
      calendar_mode: 'shared',
      employees: [],
      salon_services: [],
      hours: '',
      break_hours: '',
    };
  }

  return {
    slug: requestRow.restaurant_slug,
    name: requestRow.restaurant_name || 'Ihr Betrieb',
    email: requestRow.restaurant_email || '',
    service_type: extractFromNote(requestRow.note, 'Service') ? 'friseur' : 'restaurant',
    slot_capacity: 3,
    slot_interval_minutes: 45,
    plan_tier: 'basic',
    calendar_mode: 'shared',
    employees: [],
    salon_services: [],
    hours: '',
    break_hours: '',
  };
};

const approveRequest = async (supabase: any, requestId: string): Promise<string> => {
  const requestRow = await loadRequest(supabase, requestId);
  if (!requestRow) {
    return 'request-not-found';
  }
  if (requestRow.status === 'rejected') {
    return 'already-rejected';
  }

  const existingResult = await supabase
    .from('reservations')
    .select('id')
    .eq('booking_request_id', requestId)
    .maybeSingle();
  if (existingResult.error) {
    throw existingResult.error;
  }
  if (requestRow.status === 'approved' || existingResult.data) {
    if (requestRow.status !== 'approved') {
      await updateRequestStatus(supabase, requestId, 'approved');
    }
    return 'already-approved';
  }

  const company = await loadCompany(supabase, requestRow);
  const employeeMode = isEmployeeCalendar(company);
  const serviceValue = extractFromNote(requestRow.note, 'Service-ID');
  const serviceLabel = extractFromNote(requestRow.note, 'Service');
  const durationMinutes = employeeMode
    ? getServiceDuration(company, serviceValue, serviceLabel)
    : Number(requestRow.duration_minutes) || Number(company.slot_interval_minutes) || 45;
  let employeeId = String(requestRow.employee_id || '');

  if (employeeMode) {
    const availableEmployees = await getAvailableEmployees(supabase, company, {
      date: requestRow.date,
      time: requestRow.time,
      durationMinutes,
      serviceValue,
      employeeId,
    });
    employeeId = availableEmployees[0]?.id || '';
  }

  const reservationRecord = {
    restaurant_slug: requestRow.restaurant_slug,
    restaurant_name: requestRow.restaurant_name || company.name,
    restaurant_email: requestRow.restaurant_email || company.email,
    guest_name: requestRow.guest_name,
    guest_email: requestRow.guest_email,
    phone: requestRow.phone,
    people: requestRow.people,
    note: requestRow.note,
    date: requestRow.date,
    time: requestRow.time,
    booking_request_id: requestId,
    employee_id: employeeId || null,
    duration_minutes: durationMinutes,
  };

  let insertResult = await supabase.from('reservations').insert(reservationRecord);
  if (insertResult.error?.code === '23505' && employeeId) {
    insertResult = await supabase
      .from('reservations')
      .insert({ ...reservationRecord, employee_id: null });
  }
  if (insertResult.error) {
    const duplicateRequest =
      insertResult.error.code === '23505' &&
      String(insertResult.error.message || '').includes('reservations_booking_request_id_unique');
    if (!duplicateRequest) {
      throw insertResult.error;
    }
  }

  try {
    await updateRequestStatus(supabase, requestId, 'approved');
  } catch (error) {
    if (!insertResult.error) {
      await supabase.from('reservations').delete().eq('booking_request_id', requestId);
    }
    throw error;
  }
  return 'approved';
};

const rejectRequest = async (supabase: any, requestId: string): Promise<string> => {
  const requestRow = await loadRequest(supabase, requestId);
  if (!requestRow) {
    return 'request-not-found';
  }

  const existingResult = await supabase
    .from('reservations')
    .select('id')
    .eq('booking_request_id', requestId)
    .maybeSingle();
  if (existingResult.error) {
    throw existingResult.error;
  }
  if (existingResult.data) {
    if (requestRow.status !== 'approved') {
      await updateRequestStatus(supabase, requestId, 'approved');
    }
    return 'already-approved';
  }
  if (requestRow.status === 'approved') {
    return 'already-approved';
  }
  if (requestRow.status === 'rejected') {
    return 'already-rejected';
  }
  await updateRequestStatus(supabase, requestId, 'rejected');
  return 'rejected';
};

module.exports = async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const webhookSecret = String(process.env.RESEND_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    res.status(500).json({ error: 'Missing RESEND_WEBHOOK_SECRET' });
    return;
  }

  let event: any;
  try {
    const webhook = new Webhook(webhookSecret);
    event = webhook.verify(getRawPayload(req.body), {
      'svix-id': getHeader(req, 'svix-id'),
      'svix-timestamp': getHeader(req, 'svix-timestamp'),
      'svix-signature': getHeader(req, 'svix-signature'),
    });
  } catch (error) {
    console.error('invalid resend inbound webhook', error);
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  if (event?.type !== 'email.received') {
    res.status(200).json({ ignored: true });
    return;
  }

  const recipients = [
    ...asAddressList(event.data?.to),
    ...asAddressList(event.data?.cc),
    ...asAddressList(event.data?.bcc),
  ];
  const action = recipients.map((address) => parseInboundBookingAddress(address)).find(Boolean);
  if (!action) {
    res.status(200).json({ ignored: true, reason: 'no-booking-action-recipient' });
    return;
  }

  try {
    const supabase = getClient();
    const result =
      action.action === 'approve'
        ? await approveRequest(supabase, action.requestId)
        : await rejectRequest(supabase, action.requestId);
    res.status(200).json({ success: true, action: action.action, result });
  } catch (error: any) {
    console.error('resend inbound booking action failed', error);
    res.status(500).json({ error: error?.message || 'Inbound booking action failed' });
  }
};
