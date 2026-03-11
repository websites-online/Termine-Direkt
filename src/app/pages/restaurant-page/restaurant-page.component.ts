import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Company, CompanyApiService } from '../../services/company-api.service';

type TimeRange = { start: number; end: number };
type ParsedSchedule = {
  weekdays: Map<number, TimeRange[]>;
  holidays: TimeRange[];
};

@Component({
  selector: 'app-restaurant-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './restaurant-page.component.html',
  styleUrl: './restaurant-page.component.css'
})
export class RestaurantPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly companyService = inject(CompanyApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
  company: Company | null = null;
  slots: string[] = [];
  slotCounts: Record<string, number> = {};
  readonly weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  readonly monthNames = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember'
  ];
  private readonly baseDate = new Date();
  private readonly today = new Date(
    this.baseDate.getFullYear(),
    this.baseDate.getMonth(),
    this.baseDate.getDate()
  );
  private readonly bookingBufferMinutes = 120;
  private parsedScheduleCache: { source: string; value: ParsedSchedule } | null = null;
  private holidayCache = new Map<number, Set<string>>();
  monthOffset = 0;
  calendarDays = this.generateCalendar(
    this.baseDate.getFullYear(),
    this.baseDate.getMonth(),
    this.baseDate.getDate()
  );
  selectedDate = this.formatDateISO(this.baseDate);
  selectedDateLabel = this.formatDate(this.baseDate);
  private selectedDateObj = new Date(
    this.baseDate.getFullYear(),
    this.baseDate.getMonth(),
    this.baseDate.getDate()
  );
  successMessage = '';
  errorMessage = '';
  isSubmitting = false;
  showThanksModal = false;
  lastReservationDate = '';
  lastReservationTime = '';

  readonly bookingForm = this.formBuilder.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    people: [2, [Validators.required, Validators.min(1)]],
    seating: ['egal'],
    service: [''],
    note: [''],
    time: ['18:00', Validators.required]
  });

  ngOnInit(): void {
    this.loadCompany();
  }

  submit(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.showThanksModal = false;

    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    const serviceValue = this.getSalonServiceLabel(this.bookingForm.value.service ?? '');
    if (this.isSalon && serviceValue.length === 0) {
      this.errorMessage = 'Bitte wählen Sie eine gewünschte Leistung aus.';
      this.bookingForm.get('service')?.markAsTouched();
      return;
    }
    const seatingValue = this.getSeatingLabel(this.bookingForm.value.seating ?? '');

    if (!this.company?.email) {
      this.errorMessage = 'Restaurant-E-Mail fehlt. Bitte später erneut versuchen.';
      return;
    }

    const requestedTime = this.bookingForm.value.time ?? '';
    if (this.isSlotTooSoon(requestedTime)) {
      this.errorMessage = 'Bitte beachten Sie: Reservierungen sind frühestens 2 Stunden im Voraus möglich.';
      return;
    }

    const payload = {
      restaurantName: this.company.name,
      restaurantSlug: this.slug,
      restaurantEmail: this.company.email,
      serviceType: this.company.serviceType || 'restaurant',
      guestEmail: this.bookingForm.value.email ?? '',
      guestName: this.bookingForm.value.name ?? '',
      seating: this.hasSeatingChoice ? seatingValue : undefined,
      service: this.isSalon ? serviceValue : undefined,
      date: this.selectedDate,
      time: this.bookingForm.value.time ?? '',
      people: this.isSalon ? 1 : (this.bookingForm.value.people ?? 2),
      phone: this.bookingForm.value.phone ?? '',
      note: this.bookingForm.value.note ?? ''
    };

    const reservationDate = this.selectedDateLabel;
    const reservationTime = requestedTime;

    this.isSubmitting = true;
    this.http.post<{ success: boolean; requestMode?: boolean }>('/api/reservations', payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.lastReservationDate = reservationDate;
        this.lastReservationTime = reservationTime;
        this.showThanksModal = true;
        this.successMessage = this.getSuccessMessage();
        this.loadSlotAvailability();
        this.bookingForm.reset({
          name: '',
          email: '',
          phone: '',
          people: 2,
          seating: 'egal',
          service: '',
          note: '',
          time: '18:00'
        });
      },
      error: (error) => {
        this.isSubmitting = false;
        if (error?.status === 409) {
          this.errorMessage = 'Dieser Slot ist leider ausgebucht.';
          this.loadSlotAvailability();
          return;
        }
        this.errorMessage = 'Senden fehlgeschlagen. Bitte später erneut versuchen.';
      }
    });
  }

  closeThanksModal(): void {
    this.showThanksModal = false;
  }

  get isSalon(): boolean {
    return this.company?.serviceType === 'friseur';
  }

  get isRequestMode(): boolean {
    return this.company?.bookingMode === 'request';
  }

  get hasSeatingChoice(): boolean {
    return !this.isSalon && this.company?.seatingOptionsEnabled === true;
  }

  get bookingTitle(): string {
    if (this.isRequestMode) {
      return this.isSalon ? 'Terminanfrage' : 'Reservierungsanfrage';
    }
    return this.isSalon ? 'Termindetails' : 'Reservierungsdetails';
  }

  get bookingButtonLabel(): string {
    if (this.isRequestMode) {
      return this.isSalon ? 'Terminanfrage senden' : 'Reservierungsanfrage senden';
    }
    return this.isSalon ? 'Termin buchen' : 'Reservierung senden';
  }

  get bookingSuccessHeadline(): string {
    if (this.isRequestMode) {
      return this.isSalon
        ? 'Vielen Dank für Ihre Terminanfrage!'
        : 'Vielen Dank für Ihre Reservierungsanfrage!';
    }
    return this.isSalon ? 'Vielen Dank für Ihren Termin!' : 'Vielen Dank für Ihre Reservierung!';
  }

  get bookingConfirmText(): string {
    if (this.isRequestMode) {
      return this.isSalon
        ? 'Ihre Terminanfrage wurde gesendet. Der Salon meldet sich zeitnah bei Ihnen.'
        : 'Ihre Reservierungsanfrage wurde gesendet. Das Restaurant meldet sich zeitnah bei Ihnen.';
    }
    return this.isSalon
      ? 'Wir haben Ihre Termin-Anfrage erhalten. Eine Bestätigung wird Ihnen per E-Mail zugesendet.'
      : 'Wir haben Ihre Reservierung erhalten. Eine Bestätigung wird Ihnen per E-Mail zugesendet.';
  }

  get guestCountLabel(): string {
    return this.isSalon ? 'Kunden*' : 'Personen*';
  }

  get salonServices(): Array<{ value: string; label: string }> {
    return [
      { value: 'haarschnitt', label: 'Haarschnitt' },
      { value: 'haarschnitt_bart', label: 'Haarschnitt und Bart' },
      { value: 'bart', label: 'Bart' },
      { value: 'haarschnitt_bart_augenbrauen', label: 'Haarschnitt, Bart und Augenbrauen' },
      { value: 'faerben', label: 'Färben' },
      { value: 'faerben_schneiden_frauen', label: 'Färben und Schneiden (Frauen)' },
      { value: 'waschen_schneiden_frauen', label: 'Waschen und Schneiden (Frauen)' },
      { value: 'ansaetze_faerben_frauen', label: 'Ansätze färben (Frauen)' },
      { value: 'sonstiges', label: 'Sonstiges' }
    ];
  }

  get seatingOptions(): Array<{ value: string; label: string }> {
    return [
      { value: 'egal', label: 'Beliebig' },
      { value: 'inside', label: 'Tisch drinnen' },
      { value: 'outside', label: 'Tisch draußen' }
    ];
  }

  private getSuccessMessage(): string {
    if (this.isRequestMode) {
      return this.isSalon ? 'Terminanfrage wurde gesendet.' : 'Reservierungsanfrage wurde gesendet.';
    }
    return this.isSalon ? 'Termin wurde gesendet.' : 'Reservierung wurde gesendet.';
  }

  private getSalonServiceLabel(value: string): string {
    if (!this.isSalon) {
      return '';
    }
    const match = this.salonServices.find((item) => item.value === value);
    return match ? match.label : '';
  }

  private getSeatingLabel(value: string): string {
    if (!this.hasSeatingChoice) {
      return '';
    }
    if (value === 'egal' || !value) {
      return '';
    }
    const match = this.seatingOptions.find((item) => item.value === value);
    return match ? match.label : '';
  }

  private updateServiceValidators(): void {
    const control = this.bookingForm.get('service');
    if (!control) {
      return;
    }
    if (this.isSalon) {
      control.setValidators([Validators.required]);
    } else {
      control.clearValidators();
    }
    control.updateValueAndValidity();
  }

  private updateSeatingValidators(): void {
    const control = this.bookingForm.get('seating');
    if (!control) {
      return;
    }
    if (!this.hasSeatingChoice) {
      control.clearValidators();
      control.setValue('egal', { emitEvent: false });
    } else if (!control.value) {
      control.setValue('egal', { emitEvent: false });
    }
    control.updateValueAndValidity();
  }

  selectDate(day: { label: number; muted: boolean; active: boolean; date?: Date }): void {
    if (day.muted || !day.date) {
      return;
    }
    this.selectedDateObj = day.date;
    this.selectedDate = this.formatDateISO(day.date);
    this.selectedDateLabel = this.formatDate(day.date);
    this.calendarDays.forEach((entry) => {
      entry.active = !entry.muted && entry.date?.getTime() === day.date?.getTime();
    });
    this.slots = this.generateSlots(this.selectedDateObj);
    const currentTime = this.bookingForm.value.time ?? '';
    if (!this.slots.includes(currentTime) || this.isSlotTooSoon(currentTime)) {
      const nextSlot = this.slots.find(
        (slot) => !this.isSlotFull(slot) && !this.isSlotTooSoon(slot)
      );
      this.bookingForm.patchValue({ time: nextSlot || '' });
    }
    this.loadSlotAvailability();
  }

  onSlotClick(slot: string): void {
    if (this.isSlotTooSoon(slot)) {
      this.errorMessage = 'Bitte beachten Sie: Reservierungen sind frühestens 2 Stunden im Voraus möglich.';
      return;
    }
    this.errorMessage = '';
    this.bookingForm.patchValue({ time: slot });
  }

  get currentMonthLabel(): string {
    const date = new Date(
      this.baseDate.getFullYear(),
      this.baseDate.getMonth() + this.monthOffset,
      1
    );
    return `${this.monthNames[date.getMonth()]} ${date.getFullYear()}`;
  }

  get canGoPrev(): boolean {
    return this.monthOffset > 0;
  }

  get canGoNext(): boolean {
    return this.monthOffset < 2;
  }

  prevMonth(): void {
    if (!this.canGoPrev) {
      return;
    }
    this.monthOffset -= 1;
    this.refreshCalendar();
  }

  nextMonth(): void {
    if (!this.canGoNext) {
      return;
    }
    this.monthOffset += 1;
    this.refreshCalendar();
  }

  private refreshCalendar(): void {
    const baseYear = this.baseDate.getFullYear();
    const baseMonth = this.baseDate.getMonth();
    const activeDay = this.monthOffset === 0 ? this.baseDate.getDate() : 1;
    this.calendarDays = this.generateCalendar(baseYear, baseMonth + this.monthOffset, activeDay);
    const firstActive = this.calendarDays.find((entry) => !entry.muted && entry.date);
    if (firstActive?.date) {
      this.selectedDateObj = firstActive.date;
      this.selectedDate = this.formatDateISO(firstActive.date);
      this.selectedDateLabel = this.formatDate(firstActive.date);
      this.calendarDays.forEach((entry) => {
        entry.active =
          !entry.muted && entry.date?.getTime() === this.selectedDateObj.getTime();
      });
      this.slots = this.generateSlots(this.selectedDateObj);
      const currentTime = this.bookingForm.value.time ?? '';
      if (!this.slots.includes(currentTime) || this.isSlotTooSoon(currentTime)) {
        const nextSlot = this.slots.find(
          (slot) => !this.isSlotFull(slot) && !this.isSlotTooSoon(slot)
        );
        this.bookingForm.patchValue({ time: nextSlot || '' });
      }
    }
  }

  private generateSlots(date: Date | null): string[] {
    const ranges = this.getHoursRangesForDate(date);
    if (ranges.length === 0) {
      return [];
    }
    const breaks = this.getBreakRanges();
    const slots: string[] = [];

    const intervalMinutes = this.getSlotIntervalMinutes();
    for (const range of ranges) {
      let minutes = range.start;
      const endMinutes = range.end;

      while (minutes < endMinutes) {
        if (!this.isInBreak(minutes, breaks)) {
          const hour = Math.floor(minutes / 60)
            .toString()
            .padStart(2, '0');
          const minute = (minutes % 60).toString().padStart(2, '0');
          slots.push(`${hour}:${minute}`);
        }
        minutes += intervalMinutes;
      }
    }

    return slots;
  }

  private getFallbackHoursRange(): TimeRange {
    const fallback = { start: 12 * 60, end: 20 * 60 };
    const hours = this.company?.hours;
    if (!hours) {
      return fallback;
    }

    const match = hours.match(/(\d{1,2}(?::\d{2})?)\s*[–-]\s*(\d{1,2}(?::\d{2})?)/);
    if (!match) {
      return fallback;
    }

    const start = this.toMinutes(match[1]);
    const end = this.toMinutes(match[2]);
    if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
      return fallback;
    }

    return { start, end };
  }

  private getHoursRangesForDate(date: Date | null): TimeRange[] {
    const schedule = this.parseHoursSchedule();
    if (
      !date ||
      (schedule.weekdays.size === 0 && schedule.holidays.length === 0)
    ) {
      return [this.getFallbackHoursRange()];
    }

    if (schedule.holidays.length > 0 && this.isGermanNationalHoliday(date)) {
      return schedule.holidays;
    }

    const weekdayIndex = (date.getDay() + 6) % 7;
    return schedule.weekdays.get(weekdayIndex) || [];
  }

  private parseHoursSchedule(): ParsedSchedule {
    const hours = this.company?.hours?.trim();
    const emptySchedule: ParsedSchedule = { weekdays: new Map<number, TimeRange[]>(), holidays: [] };
    if (this.parsedScheduleCache && this.parsedScheduleCache.source === (hours || '')) {
      return this.parsedScheduleCache.value;
    }

    const schedule: ParsedSchedule = { weekdays: new Map<number, TimeRange[]>(), holidays: [] };
    if (!hours) {
      this.parsedScheduleCache = { source: '', value: emptySchedule };
      return emptySchedule;
    }

    if (hours.toLowerCase() === 'geschlossen') {
      this.parsedScheduleCache = { source: hours, value: schedule };
      return schedule;
    }

    const segments = hours
      .split(/[\n;]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    const dayMap: Record<string, number> = {
      Mo: 0,
      Di: 1,
      Mi: 2,
      Do: 3,
      Fr: 4,
      Sa: 5,
      So: 6
    };

    for (const segment of segments) {
      const matches = Array.from(
        segment.matchAll(/(\d{1,2}(?::\d{2})?)\s*[–-]\s*(\d{1,2}(?::\d{2})?)/g)
      );
      if (matches.length === 0) {
        continue;
      }

      const firstIndex = matches[0].index ?? 0;
      const daysPart = segment.slice(0, firstIndex).trim();
      const includesHoliday = /feiertag|feiertage|feiertagen/i.test(daysPart);
      const normalizedDaysPart = daysPart
        .replace(/feiertage?n?/gi, '')
        .replace(/\bund\b/gi, ',')
        .replace(/\+/g, ',')
        .trim();
      const days = this.parseDayList(normalizedDaysPart, dayMap);
      const targetDays = days.length > 0 ? days : includesHoliday ? [] : [0, 1, 2, 3, 4, 5, 6];

      for (const match of matches) {
        const start = this.toMinutes(match[1]);
        const end = this.toMinutes(match[2]);
        if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
          continue;
        }
        for (const day of targetDays) {
          const existing = schedule.weekdays.get(day) || [];
          existing.push({ start, end });
          schedule.weekdays.set(day, existing);
        }
        if (includesHoliday) {
          schedule.holidays.push({ start, end });
        }
      }
    }

    schedule.weekdays.forEach((ranges, day) => {
      ranges.sort((a, b) => a.start - b.start);
      schedule.weekdays.set(day, this.mergeRanges(ranges));
    });
    schedule.holidays = this.mergeRanges(schedule.holidays.sort((a, b) => a.start - b.start));

    this.parsedScheduleCache = { source: hours, value: schedule };
    return schedule;
  }

  private parseDayList(input: string, dayMap: Record<string, number>): number[] {
    if (!input) {
      return [];
    }
    const cleaned = input.replace(/\./g, '');
    const parts = cleaned
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const result = new Set<number>();

    for (const part of parts) {
      const rangeMatch = part.match(/^([A-Za-zÄÖÜäöü]{2})\s*[–-]\s*([A-Za-zÄÖÜäöü]{2})$/);
      if (rangeMatch) {
        const startKey = this.normalizeDayKey(rangeMatch[1]);
        const endKey = this.normalizeDayKey(rangeMatch[2]);
        const start = dayMap[startKey];
        const end = dayMap[endKey];
        if (start === undefined || end === undefined) {
          continue;
        }
        if (start <= end) {
          for (let i = start; i <= end; i += 1) {
            result.add(i);
          }
        } else {
          for (let i = start; i < 7; i += 1) {
            result.add(i);
          }
          for (let i = 0; i <= end; i += 1) {
            result.add(i);
          }
        }
        continue;
      }

      const singleKey = this.normalizeDayKey(part);
      const single = dayMap[singleKey] ?? dayMap[singleKey.slice(0, 2)];
      if (single !== undefined) {
        result.add(single);
      }
    }

    return Array.from(result);
  }

  private normalizeDayKey(value: string): string {
    const trimmed = value.trim().toLowerCase();
    const map: Record<string, string> = {
      mo: 'Mo',
      montag: 'Mo',
      di: 'Di',
      dienstag: 'Di',
      mi: 'Mi',
      mittwoch: 'Mi',
      do: 'Do',
      donnerstag: 'Do',
      fr: 'Fr',
      freitag: 'Fr',
      sa: 'Sa',
      samstag: 'Sa',
      so: 'So',
      sonntag: 'So'
    };
    return map[trimmed] || (trimmed.length >= 2 ? trimmed[0].toUpperCase() + trimmed[1] : trimmed);
  }

  private mergeRanges(ranges: TimeRange[]): TimeRange[] {
    if (ranges.length <= 1) {
      return ranges;
    }
    const merged: Array<{ start: number; end: number }> = [];
    let current = ranges[0];
    for (let i = 1; i < ranges.length; i += 1) {
      const next = ranges[i];
      if (next.start <= current.end) {
        current = { start: current.start, end: Math.max(current.end, next.end) };
      } else {
        merged.push(current);
        current = next;
      }
    }
    merged.push(current);
    return merged;
  }

  private getBreakRanges(): TimeRange[] {
    const raw = this.company?.breakHours;
    if (!raw) {
      return [];
    }
    return raw
      .split(',')
      .map((value) => value.trim())
      .map((value) => value.match(/(\d{1,2}(?::\d{2})?)\s*[–-]\s*(\d{1,2}(?::\d{2})?)/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => ({
        start: this.toMinutes(match[1]),
        end: this.toMinutes(match[2])
      }))
      .filter((range) => !Number.isNaN(range.start) && !Number.isNaN(range.end));
  }

  private isInBreak(minutes: number, ranges: TimeRange[]): boolean {
    return ranges.some((range) => minutes >= range.start && minutes < range.end);
  }

  private toMinutes(time: string): number {
    const match = time.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (!match) {
      return NaN;
    }
    const hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return NaN;
    }
    return hour * 60 + minute;
  }

  private generateCalendar(
    year: number,
    monthIndex: number,
    activeDay: number
  ): Array<{ label: number; muted: boolean; active: boolean; date?: Date; today?: boolean }> {
    const firstDay = new Date(year, monthIndex, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();
    const cells: Array<{ label: number; muted: boolean; active: boolean; date?: Date; today?: boolean }> = [];

    for (let i = 0; i < 42; i += 1) {
      if (i < startOffset) {
        const label = daysInPrevMonth - startOffset + i + 1;
        cells.push({ label, muted: true, active: false });
        continue;
      }

      const dayNumber = i - startOffset + 1;
      if (dayNumber <= daysInMonth) {
        const date = new Date(year, monthIndex, dayNumber);
        const isPast = date.getTime() < this.today.getTime();
        const isToday = date.getTime() === this.today.getTime();
        const isClosed = this.getHoursRangesForDate(date).length === 0;
        cells.push({
          label: dayNumber,
          muted: isPast || isClosed,
          active: !isPast && !isClosed && dayNumber === activeDay,
          date,
          today: isToday
        });
        continue;
      }

      const label = dayNumber - daysInMonth;
      cells.push({ label, muted: true, active: false });
    }

    return cells;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  private formatDateISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isGermanNationalHoliday(date: Date): boolean {
    const year = date.getFullYear();
    if (!this.holidayCache.has(year)) {
      this.holidayCache.set(year, this.getGermanNationalHolidays(year));
    }
    const key = this.formatDateISO(date);
    return this.holidayCache.get(year)?.has(key) || false;
  }

  private getGermanNationalHolidays(year: number): Set<string> {
    const holidays = new Set<string>();
    const add = (monthIndex: number, day: number): void => {
      holidays.add(this.formatDateISO(new Date(year, monthIndex, day)));
    };

    // Fixed national holidays (Germany-wide)
    add(0, 1); // Neujahr
    add(4, 1); // Tag der Arbeit
    add(9, 3); // Tag der Deutschen Einheit
    add(11, 25); // 1. Weihnachtstag
    add(11, 26); // 2. Weihnachtstag

    const easterSunday = this.getEasterSunday(year);
    const addOffset = (days: number): void => {
      const d = new Date(easterSunday);
      d.setDate(d.getDate() + days);
      holidays.add(this.formatDateISO(d));
    };

    addOffset(-2); // Karfreitag
    addOffset(1); // Ostermontag
    addOffset(39); // Christi Himmelfahrt
    addOffset(50); // Pfingstmontag

    return holidays;
  }

  private getEasterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  private loadCompany(): void {
    this.companyService.getCompany(this.slug).subscribe({
      next: (company) => {
        this.company = company;
        this.updateServiceValidators();
        this.updateSeatingValidators();
        this.refreshCalendar();
        this.loadSlotAvailability();
      },
      error: () => {
        this.company = null;
      }
    });
  }

  private loadSlotAvailability(): void {
    if (!this.company || !this.selectedDate) {
      return;
    }
    const query = `restaurantSlug=${encodeURIComponent(this.slug)}&date=${encodeURIComponent(
      this.selectedDate
    )}`;
    this.http.get<{ slots: Record<string, number> }>(`/api/reservations?${query}`).subscribe({
      next: (response) => {
        this.slotCounts = response.slots || {};
        const current = this.bookingForm.value.time || '';
        if (current && (this.isSlotFull(current) || this.isSlotTooSoon(current))) {
          const nextSlot = this.slots.find(
            (slot) => !this.isSlotFull(slot) && !this.isSlotTooSoon(slot)
          );
          this.bookingForm.patchValue({ time: nextSlot || '' });
        }
      }
    });
  }

  isSlotFull(slot: string): boolean {
    return (this.slotCounts[slot] || 0) >= this.getSlotCapacity();
  }

  isSlotTooSoon(slot: string): boolean {
    if (!this.isTodaySelected()) {
      return false;
    }
    const slotMinutes = this.toMinutes(slot);
    if (Number.isNaN(slotMinutes)) {
      return false;
    }
    const earliest = this.getEarliestBookableMinutes();
    return slotMinutes < earliest;
  }

  private isTodaySelected(): boolean {
    return this.selectedDateObj?.getTime() === this.today.getTime();
  }

  private getEarliestBookableMinutes(): number {
    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    return minutesNow + this.bookingBufferMinutes;
  }

  private getSlotCapacity(): number {
    const capacity = this.company?.slotCapacity;
    if (typeof capacity !== 'number' || Number.isNaN(capacity)) {
      return 3;
    }
    return Math.min(Math.max(capacity, 1), 3);
  }

  private getSlotIntervalMinutes(): 30 | 45 | 60 {
    const value = this.company?.slotIntervalMinutes;
    if (value === 30 || value === 60) {
      return value;
    }
    return 45;
  }
}
