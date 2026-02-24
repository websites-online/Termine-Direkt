import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Company, CompanyApiService } from '../../services/company-api.service';

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
  private readonly slotIntervalMinutes = 45;
  private readonly bookingBufferMinutes = 120;
  monthOffset = 0;
  calendarDays = this.generateCalendar(
    this.baseDate.getFullYear(),
    this.baseDate.getMonth(),
    this.baseDate.getDate()
  );
  selectedDate = this.formatDate(this.baseDate);
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
      guestEmail: this.bookingForm.value.email ?? '',
      guestName: this.bookingForm.value.name ?? '',
      date: this.selectedDate,
      time: this.bookingForm.value.time ?? '',
      people: this.bookingForm.value.people ?? 2,
      phone: this.bookingForm.value.phone ?? '',
      note: this.bookingForm.value.note ?? ''
    };

    const reservationDate = this.selectedDate;
    const reservationTime = requestedTime;

    this.isSubmitting = true;
    this.http.post('/api/reservations', payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.lastReservationDate = reservationDate;
        this.lastReservationTime = reservationTime;
        this.showThanksModal = true;
        this.successMessage = 'Reservierung wurde gesendet.';
        this.loadSlotAvailability();
        this.bookingForm.reset({
          name: '',
          email: '',
          phone: '',
          people: 2,
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

  selectDate(day: { label: number; muted: boolean; active: boolean; date?: Date }): void {
    if (day.muted || !day.date) {
      return;
    }
    this.selectedDateObj = day.date;
    this.selectedDate = this.formatDate(day.date);
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
      this.selectedDate = this.formatDate(firstActive.date);
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
        minutes += this.slotIntervalMinutes;
      }
    }

    return slots;
  }

  private getFallbackHoursRange(): { start: number; end: number } {
    const fallback = { start: 12 * 60, end: 20 * 60 };
    const hours = this.company?.hours;
    if (!hours) {
      return fallback;
    }

    const match = hours.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
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

  private getHoursRangesForDate(date: Date | null): Array<{ start: number; end: number }> {
    const schedule = this.parseHoursSchedule();
    if (!date || schedule.size === 0) {
      return [this.getFallbackHoursRange()];
    }
    const weekdayIndex = (date.getDay() + 6) % 7;
    return schedule.get(weekdayIndex) || [];
  }

  private parseHoursSchedule(): Map<number, Array<{ start: number; end: number }>> {
    const hours = this.company?.hours?.trim();
    const schedule = new Map<number, Array<{ start: number; end: number }>>();
    if (!hours) {
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
        segment.matchAll(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/g)
      );
      if (matches.length === 0) {
        continue;
      }

      const firstIndex = matches[0].index ?? 0;
      const daysPart = segment.slice(0, firstIndex).trim();
      const days = this.parseDayList(daysPart, dayMap);
      const targetDays = days.length > 0 ? days : [0, 1, 2, 3, 4, 5, 6];

      for (const match of matches) {
        const start = this.toMinutes(match[1]);
        const end = this.toMinutes(match[2]);
        if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
          continue;
        }
        for (const day of targetDays) {
          const existing = schedule.get(day) || [];
          existing.push({ start, end });
          schedule.set(day, existing);
        }
      }
    }

    schedule.forEach((ranges, day) => {
      ranges.sort((a, b) => a.start - b.start);
      schedule.set(day, this.mergeRanges(ranges));
    });

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
      const single = dayMap[singleKey];
      if (single !== undefined) {
        result.add(single);
      }
    }

    return Array.from(result);
  }

  private normalizeDayKey(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      return trimmed;
    }
    return trimmed[0].toUpperCase() + trimmed[1].toLowerCase();
  }

  private mergeRanges(ranges: Array<{ start: number; end: number }>) {
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

  private getBreakRanges(): Array<{ start: number; end: number }> {
    const raw = this.company?.breakHours;
    if (!raw) {
      return [];
    }
    return raw
      .split(',')
      .map((value) => value.trim())
      .map((value) => value.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => ({
        start: this.toMinutes(match[1]),
        end: this.toMinutes(match[2])
      }))
      .filter((range) => !Number.isNaN(range.start) && !Number.isNaN(range.end));
  }

  private isInBreak(minutes: number, ranges: Array<{ start: number; end: number }>): boolean {
    return ranges.some((range) => minutes >= range.start && minutes < range.end);
  }

  private toMinutes(time: string): number {
    const [hour, minute] = time.split(':').map((value) => Number(value));
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
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
    const openDays = this.getOpenWeekdayIndexes();
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
        const weekdayIndex = (date.getDay() + 6) % 7;
        const isClosed = !openDays.has(weekdayIndex);
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

  private getOpenWeekdayIndexes(): Set<number> {
    const schedule = this.parseHoursSchedule();
    if (schedule.size === 0) {
      return new Set([0, 1, 2, 3, 4, 5, 6]);
    }
    return new Set(Array.from(schedule.keys()));
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  private loadCompany(): void {
    this.companyService.getCompany(this.slug).subscribe({
      next: (company) => {
        this.company = company;
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
    return (this.slotCounts[slot] || 0) >= 3;
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
}
