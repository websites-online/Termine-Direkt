type Employee = {
  id: string;
  name: string;
  color: string;
  hours: string;
  breakHours?: string;
  serviceValues: string[];
};

const toMinutes = (value: unknown): number => {
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(value || '').trim());
  if (!match) {
    return Number.NaN;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : Number.NaN;
};

const normalizeEmployees = (value: unknown): Employee[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item, index) => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const name = String(record.name || '').trim();
      const id = String(record.id || `employee-${index + 1}`).trim();
      if (!id || !name) {
        return null;
      }
      return {
        id,
        name,
        color: /^#[0-9a-f]{6}$/i.test(String(record.color || ''))
          ? String(record.color).toLowerCase()
          : '#4f46e5',
        hours: String(record.hours || '').trim(),
        breakHours: String(record.breakHours || '').trim() || undefined,
        serviceValues: Array.isArray(record.serviceValues)
          ? record.serviceValues.map((service) => String(service || '').trim()).filter(Boolean)
          : [],
      };
    })
    .filter(Boolean) as Employee[];
};

const isEmployeeCalendar = (company: any): boolean =>
  company?.service_type === 'friseur' &&
  company?.plan_tier === 'pro' &&
  company?.calendar_mode === 'employee' &&
  normalizeEmployees(company?.employees).length > 0;

const normalizeDay = (value: string): number | null => {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 2);
  const days: Record<string, number> = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
  return days[normalized] ?? null;
};

const dayMatches = (day: number, from: number, to: number): boolean => {
  if (from <= to) {
    return day >= from && day <= to;
  }
  return day >= from || day <= to;
};

const parseRanges = (value: string): Array<{ start: number; end: number }> => {
  const ranges: Array<{ start: number; end: number }> = [];
  const normalized = value.replace(/[–—]/g, '-');
  const regex = /(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)/g;
  for (const match of normalized.matchAll(regex)) {
    const start = toMinutes(match[1]);
    const end = toMinutes(match[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      ranges.push({ start, end });
    }
  }
  return ranges;
};

const getWorkingRanges = (
  hours: string,
  dateValue: string,
): Array<{ start: number; end: number }> => {
  const date = new Date(`${dateValue}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return [];
  }
  const day = date.getUTCDay();
  const matching: Array<{ start: number; end: number }> = [];
  String(hours || '')
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const normalized = segment.replace(/[–—]/g, '-');
      const dayMatch = /^([^\s]+)\s+/.exec(normalized);
      if (!dayMatch) {
        return;
      }
      const dayParts = dayMatch[1].split('-');
      const from = normalizeDay(dayParts[0]);
      const to = normalizeDay(dayParts[1] || dayParts[0]);
      if (from === null || to === null || !dayMatches(day, from, to)) {
        return;
      }
      matching.push(...parseRanges(normalized.slice(dayMatch[0].length)));
    });
  return matching;
};

const isEmployeeWorking = (
  employee: Employee,
  company: any,
  date: string,
  start: number,
  end: number,
): boolean => {
  const hours = employee.hours || company?.hours || '';
  const workingRanges = getWorkingRanges(hours, date);
  const hasConfiguredHours = parseRanges(hours).length > 0;
  if (
    hasConfiguredHours &&
    !workingRanges.some((range) => start >= range.start && end <= range.end)
  ) {
    return false;
  }
  const breaks = parseRanges(employee.breakHours || company?.break_hours || '');
  return !breaks.some((range) => start < range.end && end > range.start);
};

const getService = (company: any, serviceValue: string, serviceLabel = ''): any => {
  const services = Array.isArray(company?.salon_services) ? company.salon_services : [];
  return services.find(
    (service: any) =>
      String(service?.value || '') === serviceValue ||
      (!serviceValue &&
        String(service?.label || '')
          .trim()
          .toLowerCase() === serviceLabel.trim().toLowerCase()),
  );
};

const getServiceDuration = (company: any, serviceValue: string, serviceLabel = ''): number => {
  const duration = Number(getService(company, serviceValue, serviceLabel)?.durationMinutes);
  if (Number.isFinite(duration) && duration >= 15 && duration <= 480) {
    return Math.round(duration);
  }
  const fallback = Number(company?.slot_interval_minutes);
  return fallback === 30 || fallback === 60 ? fallback : 45;
};

const employeeOffersService = (employee: Employee, serviceValue: string): boolean =>
  !serviceValue ||
  employee.serviceValues.length === 0 ||
  employee.serviceValues.includes(serviceValue);

const getAvailableEmployees = async (
  supabase: any,
  company: any,
  input: {
    date: string;
    time: string;
    durationMinutes: number;
    serviceValue?: string;
    employeeId?: string;
  },
): Promise<Employee[]> => {
  if (!isEmployeeCalendar(company)) {
    return [];
  }
  const { data, error } = await supabase
    .from('reservations')
    .select('employee_id,time,duration_minutes')
    .eq('restaurant_slug', company.slug)
    .eq('date', input.date);
  if (error) {
    throw error;
  }
  return getAvailableEmployeesFromRows(company, input, data || []);
};

const getAvailableEmployeesFromRows = (
  company: any,
  input: {
    date: string;
    time: string;
    durationMinutes: number;
    serviceValue?: string;
    employeeId?: string;
  },
  rows: any[],
): Employee[] => {
  const start = toMinutes(input.time);
  const end = start + input.durationMinutes;
  if (!Number.isFinite(start) || end > 24 * 60) {
    return [];
  }
  const candidates = normalizeEmployees(company.employees).filter(
    (employee) =>
      (!input.employeeId || employee.id === input.employeeId) &&
      employeeOffersService(employee, input.serviceValue || '') &&
      isEmployeeWorking(employee, company, input.date, start, end),
  );
  const occupied = new Set<string>();
  let unassignedOverlapCount = 0;
  rows.forEach((row: any) => {
    const rowStart = toMinutes(row.time);
    const rowDuration = Number(row.duration_minutes) || Number(company.slot_interval_minutes) || 45;
    const rowEnd = rowStart + rowDuration;
    if (Number.isFinite(rowStart) && start < rowEnd && end > rowStart) {
      if (row.employee_id) {
        occupied.add(String(row.employee_id));
      } else {
        // Existing appointments created before the employee calendar was enabled
        // still consume one team member's capacity, even without an assignment.
        unassignedOverlapCount += 1;
      }
    }
  });
  const available = candidates.filter((employee) => !occupied.has(employee.id));
  return available.slice(0, Math.max(0, available.length - unassignedOverlapCount));
};

const extractFromNote = (note: unknown, key: string): string => {
  const match = String(note || '').match(new RegExp(`${key}:\\s*([^|]+)`, 'i'));
  return match?.[1]?.trim() || '';
};

module.exports = {
  extractFromNote,
  getAvailableEmployees,
  getAvailableEmployeesFromRows,
  getServiceDuration,
  isEmployeeCalendar,
  normalizeEmployees,
};
