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

    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    if (!this.company?.email) {
      this.errorMessage = 'Restaurant-E-Mail fehlt. Bitte später erneut versuchen.';
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

    this.isSubmitting = true;
    this.http.post('/api/reservations', payload).subscribe({
      next: () => {
        this.isSubmitting = false;
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

  selectDate(day: { label: number; muted: boolean; active: boolean; date?: Date }): void {
    if (day.muted || !day.date) {
      return;
    }
    this.selectedDateObj = day.date;
    this.selectedDate = this.formatDate(day.date);
    this.calendarDays.forEach((entry) => {
      entry.active = !entry.muted && entry.date?.getTime() === day.date?.getTime();
    });
    this.loadSlotAvailability();
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
    const activeDay = 1;
    this.calendarDays = this.generateCalendar(baseYear, baseMonth + this.monthOffset, activeDay);
    const firstActive = this.calendarDays.find((entry) => !entry.muted && entry.date);
    if (firstActive?.date) {
      this.selectedDateObj = firstActive.date;
      this.selectedDate = this.formatDate(firstActive.date);
      this.calendarDays.forEach((entry) => {
        entry.active =
          !entry.muted && entry.date?.getTime() === this.selectedDateObj.getTime();
      });
    }
  }

  private generateSlots(): string[] {
    const { start, end } = this.getHoursRange();
    const breaks = this.getBreakRanges();
    const slots: string[] = [];
    let minutes = start;
    const endMinutes = end;

    while (minutes < endMinutes) {
      if (!this.isInBreak(minutes, breaks)) {
        const hour = Math.floor(minutes / 60)
          .toString()
          .padStart(2, '0');
        const minute = (minutes % 60).toString().padStart(2, '0');
        slots.push(`${hour}:${minute}`);
      }
      minutes += 45;
    }

    return slots;
  }

  private getHoursRange(): { start: number; end: number } {
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
  ): Array<{ label: number; muted: boolean; active: boolean; date?: Date }> {
    const firstDay = new Date(year, monthIndex, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();
    const cells: Array<{ label: number; muted: boolean; active: boolean; date?: Date }> = [];

    for (let i = 0; i < 42; i += 1) {
      if (i < startOffset) {
        const label = daysInPrevMonth - startOffset + i + 1;
        cells.push({ label, muted: true, active: false });
        continue;
      }

      const dayNumber = i - startOffset + 1;
      if (dayNumber <= daysInMonth) {
        const date = new Date(year, monthIndex, dayNumber);
        cells.push({
          label: dayNumber,
          muted: false,
          active: dayNumber === activeDay,
          date
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

  private loadCompany(): void {
    this.companyService.getCompany(this.slug).subscribe({
      next: (company) => {
        this.company = company;
        this.slots = this.generateSlots();
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
        if (current && this.isSlotFull(current)) {
          const nextSlot = this.slots.find((slot) => !this.isSlotFull(slot));
          this.bookingForm.patchValue({ time: nextSlot || '' });
        }
      }
    });
  }

  isSlotFull(slot: string): boolean {
    return (this.slotCounts[slot] || 0) >= 3;
  }
}
