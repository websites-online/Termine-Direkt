export type AdminStatsPeriod = 'this-month' | 'last-month' | 'last-30-days' | 'month' | 'all';
type ServiceType = 'restaurant' | 'friseur';

export interface AdminStatsCompany { slug: string; name: string; serviceType?: ServiceType; }
export interface AdminStatsReservation {
  restaurant_slug?: string | null;
  guest_email?: string | null;
  note?: string | null;
  booking_request_id?: string | null;
  created_at?: string | null;
}
export interface AdminStatsRequest {
  id?: string | null;
  restaurant_slug?: string | null;
  status?: string | null;
  created_at?: string | null;
}
export interface AdminStatsActivity { slug: string; day: string; kind: 'booking' | 'request'; }
export interface AdminStatsTotals {
  bookingsTotal: number;
  requestsTotal: number;
  interactionsTotal: number;
  activeCompanies: number;
}
export interface AdminStatsComparison extends AdminStatsTotals {
  from: string;
  to: string;
  mode: 'month-to-date' | 'previous-month' | 'previous-period';
}
export interface AdminStatsRow {
  slug: string;
  name: string;
  serviceType: ServiceType;
  bookings: number;
  requests: number;
  total: number;
  previousBookings: number | null;
  previousRequests: number | null;
  previousTotal: number | null;
  change: number | null;
  changePercent: number | null;
  sharePercent: number;
}
export interface AdminStatsMonth { month: string; bookings: number; requests: number; total: number; }
export interface AdminStatsResponse extends AdminStatsTotals {
  period: AdminStatsPeriod;
  from: string | null;
  to: string | null;
  companiesTotal: number;
  comparison: AdminStatsComparison | null;
  monthlyTrend: AdminStatsMonth[];
  requestsTableAvailable?: boolean;
  rows: AdminStatsRow[];
}

const berlinCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
});

export const berlinDay = (value: Date | string): string | null => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = berlinCalendar.formatToParts(date);
  const part = (name: string) => parts.find(item => item.type === name)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const isoDay = (date: Date): string => date.toISOString().slice(0, 10);
const utcDay = (day: string): Date => new Date(`${day}T00:00:00Z`);
const shiftDay = (day: string, amount: number): string => {
  const date = utcDay(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return isoDay(date);
};
const monthStart = (month: string, offset = 0): string => {
  const [year, number] = month.split('-').map(Number);
  return isoDay(new Date(Date.UTC(year, number - 1 + offset, 1)));
};
const monthEnd = (month: string): string => shiftDay(monthStart(month, 1), -1);

export const statsChangePercent = (current: number, previous: number): number | null =>
  previous === 0 ? (current === 0 ? 0 : null) : Math.round(((current - previous) / previous) * 1000) / 10;

export function adminStatsRange(periodInput: string, month: string | null | undefined, now = new Date()) {
  const today = berlinDay(now)!;
  const currentMonth = today.slice(0, 7);
  let period: AdminStatsPeriod = ['this-month', 'last-month', 'last-30-days', 'month', 'all'].includes(periodInput)
    ? periodInput as AdminStatsPeriod : 'this-month';
  if (period === 'all') return { period, from: null, to: null, previousFrom: null, previousTo: null, mode: null, today, trendMonth: currentMonth };
  if (period === 'last-30-days') {
    const from = shiftDay(today, -29);
    return { period, from, to: today, previousFrom: shiftDay(from, -30), previousTo: shiftDay(from, -1), mode: 'previous-period' as const, today, trendMonth: currentMonth };
  }
  if (period === 'month' && (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > currentMonth || month < '2000-01')) period = 'this-month';
  const selectedMonth = period === 'last-month' ? monthStart(currentMonth, -1).slice(0, 7)
    : period === 'month' ? month! : currentMonth;
  const partial = selectedMonth === currentMonth;
  const from = monthStart(selectedMonth);
  const previousFrom = monthStart(selectedMonth, -1);
  const previousMonth = previousFrom.slice(0, 7);
  const previousEnd = monthEnd(previousMonth);
  const previousTo = partial ? `${previousMonth}-${String(Math.min(Number(today.slice(8)), Number(previousEnd.slice(8)))).padStart(2, '0')}` : previousEnd;
  return { period, from, to: partial ? today : monthEnd(selectedMonth), previousFrom, previousTo, mode: partial ? 'month-to-date' as const : 'previous-month' as const, today, trendMonth: selectedMonth };
}

/** Keep approved requests in their original reception month and count them once. */
export function collectAdminStatsActivities(reservations: AdminStatsReservation[], requests: AdminStatsRequest[]): AdminStatsActivity[] {
  const byId = new Map(requests.filter(row => row.id).map(row => [row.id!, row]));
  const linkedIds = new Set<string>();
  const activities: AdminStatsActivity[] = [];
  for (const row of reservations) {
    if (!row.restaurant_slug || !row.guest_email?.trim() || /^__(?:BLOCK|INTERNAL)__:/i.test(String(row.note || '').trim())) continue;
    const request = row.booking_request_id ? byId.get(row.booking_request_id) : undefined;
    const day = berlinDay(request?.created_at || row.created_at || '');
    if (!day) continue;
    if (row.booking_request_id) linkedIds.add(row.booking_request_id);
    activities.push({ slug: row.restaurant_slug, day, kind: 'booking' });
  }
  for (const row of requests) {
    if (!row.restaurant_slug || ['approved', 'rejected'].includes(row.status || '') || (row.id && linkedIds.has(row.id))) continue;
    const day = berlinDay(row.created_at || '');
    if (day) activities.push({ slug: row.restaurant_slug, day, kind: 'request' });
  }
  return activities;
}

export function buildAdminStats(companies: AdminStatsCompany[], activities: AdminStatsActivity[], period: string, month?: string | null, now = new Date()): AdminStatsResponse {
  const range = adminStatsRange(period, month, now);
  const companyMap = new Map(companies.map(company => [company.slug, company]));
  const current = new Map<string, { bookings: number; requests: number }>();
  const previous = new Map<string, { bookings: number; requests: number }>();
  const monthlyTrend: AdminStatsMonth[] = Array.from({ length: 6 }, (_, index) => ({ month: monthStart(range.trendMonth, index - 5).slice(0, 7), bookings: 0, requests: 0, total: 0 }));
  const monthlyMap = new Map(monthlyTrend.map(point => [point.month, point]));
  const increment = (counts: typeof current, activity: AdminStatsActivity) => {
    const value = counts.get(activity.slug) || { bookings: 0, requests: 0 };
    value[activity.kind === 'booking' ? 'bookings' : 'requests']++;
    counts.set(activity.slug, value);
  };
  for (const activity of activities) {
    if (!companyMap.has(activity.slug) || activity.day > range.today) continue;
    if ((!range.from || activity.day >= range.from) && (!range.to || activity.day <= range.to)) increment(current, activity);
    if (range.previousFrom && range.previousTo && activity.day >= range.previousFrom && activity.day <= range.previousTo) increment(previous, activity);
    const point = monthlyMap.get(activity.day.slice(0, 7));
    if (point) { point[activity.kind === 'booking' ? 'bookings' : 'requests']++; point.total++; }
  }
  const totals = (counts: typeof current): AdminStatsTotals => {
    const values = Array.from(counts.values());
    const bookingsTotal = values.reduce((sum, item) => sum + item.bookings, 0);
    const requestsTotal = values.reduce((sum, item) => sum + item.requests, 0);
    return { bookingsTotal, requestsTotal, interactionsTotal: bookingsTotal + requestsTotal, activeCompanies: values.length };
  };
  const summary = totals(current);
  const comparison = range.mode && range.previousFrom && range.previousTo
    ? { ...totals(previous), from: range.previousFrom, to: range.previousTo, mode: range.mode } : null;
  const rows = Array.from(companyMap.values()).map(company => {
    const counts = current.get(company.slug) || { bookings: 0, requests: 0 };
    const before = previous.get(company.slug) || { bookings: 0, requests: 0 };
    const total = counts.bookings + counts.requests, previousTotal = before.bookings + before.requests;
    return { slug: company.slug, name: company.name, serviceType: company.serviceType || 'restaurant', ...counts, total,
      previousBookings: comparison ? before.bookings : null, previousRequests: comparison ? before.requests : null,
      previousTotal: comparison ? previousTotal : null, change: comparison ? total - previousTotal : null,
      changePercent: comparison ? statsChangePercent(total, previousTotal) : null,
      sharePercent: summary.interactionsTotal ? Math.round(total / summary.interactionsTotal * 1000) / 10 : 0 };
  }).sort((a, b) => b.total - a.total || b.bookings - a.bookings || a.name.localeCompare(b.name, 'de'));
  return { period: range.period, from: range.from, to: range.to, companiesTotal: companyMap.size, ...summary, comparison, monthlyTrend, rows };
}
