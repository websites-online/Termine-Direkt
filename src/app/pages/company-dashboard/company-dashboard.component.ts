import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { CompanyAuthService, CompanySession } from '../../services/company-auth.service';
import { Company, CompanyApiService } from '../../services/company-api.service';
import {
  CompanyReservation,
  CompanyReservationPayload,
  CompanyReservationsService
} from '../../services/company-reservations.service';

type ServiceOption = { value: string; label: string };

@Component({
  selector: 'app-company-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule],
  templateUrl: './company-dashboard.component.html',
  styleUrl: './company-dashboard.component.css'
})
export class CompanyDashboardComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  session: CompanySession | null = null;
  company: Company | null = null;
  reservations: CompanyReservation[] = [];
  selectedDate = this.getToday();
  private selectedDateObj = this.parseDate(this.getToday());
  slots: string[] = [];
  slotCounts: Record<string, number> = {};
  readonly slotIntervalMinutes = 45;
  readonly bookingBufferMinutes = 120;
  private readonly today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  isLoading = false;
  listError = '';
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  readonly serviceOptions: ServiceOption[] = [
    { value: 'Haarschnitt', label: 'Haarschnitt' },
    { value: 'Haarschnitt und Bart', label: 'Haarschnitt und Bart' },
    { value: 'Bart', label: 'Bart' },
    { value: 'Haarschnitt, Bart und Augenbrauen', label: 'Haarschnitt, Bart und Augenbrauen' },
    { value: 'Färben', label: 'Färben' },
    { value: 'Färben und Schneiden (Frauen)', label: 'Färben und Schneiden (Frauen)' },
    { value: 'Waschen und Schneiden (Frauen)', label: 'Waschen und Schneiden (Frauen)' },
    { value: 'Ansätze färben (Frauen)', label: 'Ansätze färben (Frauen)' },
    { value: 'Sonstiges', label: 'Sonstiges' }
  ];

  readonly bookingForm = this.formBuilder.group({
    date: [this.getToday(), Validators.required],
    time: ['', Validators.required],
    guestName: ['', Validators.required],
    guestEmail: ['', [Validators.email]],
    phone: [''],
    people: [2],
    service: [''],
    note: ['']
  });

  constructor(
    private readonly authService: CompanyAuthService,
    private readonly reservationsService: CompanyReservationsService,
    private readonly companyService: CompanyApiService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.session = this.authService.getSession();
    this.updateValidators();
    this.loadCompanyDetails();
    this.loadReservations();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/unternehmen/login']);
  }

  loadReservations(): void {
    this.isLoading = true;
    this.listError = '';

    this.reservationsService.listReservations(this.selectedDate).subscribe({
      next: (items) => {
        this.reservations = items;
        const counts: Record<string, number> = {};
        items.forEach((item) => {
          if (!item.time) {
            return;
          }
          counts[item.time] = (counts[item.time] || 0) + 1;
        });
        this.slotCounts = counts;
        this.refreshSlots();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.listError = 'Buchungen konnten nicht geladen werden.';
        this.refreshSlots();
      }
    });
  }

  onDateChange(value: string): void {
    if (!value) {
      return;
    }
    this.applySelectedDate(value);
  }

  setQuickDate(offsetDays: number): void {
    const target = this.getDateOffset(offsetDays);
    this.applySelectedDate(target);
  }

  submitReservation(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const value = this.bookingForm.value;
    const payload: CompanyReservationPayload = {
      date: value.date ?? this.getToday(),
      time: value.time ?? '',
      guestName: value.guestName ?? '',
      guestEmail: value.guestEmail || undefined,
      phone: value.phone || undefined,
      note: value.note || undefined,
      people: this.isSalon ? 1 : Number(value.people || 1),
      service: this.isSalon ? value.service || undefined : undefined
    };

    this.reservationsService.createReservation(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = 'Termin wurde gespeichert.';
        this.bookingForm.patchValue({
          time: '',
          guestName: '',
          guestEmail: '',
          phone: '',
          note: ''
        });
        if (this.isSalon) {
          this.bookingForm.patchValue({ service: '' });
        }
        this.loadReservations();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.message || 'Speichern fehlgeschlagen.';
      }
    });
  }

  deleteReservation(reservation: CompanyReservation): void {
    const confirmed = window.confirm('Buchung wirklich löschen?');
    if (!confirmed) {
      return;
    }
    this.reservationsService.deleteReservation(reservation.id).subscribe({
      next: () => this.loadReservations()
    });
  }

  get isSalon(): boolean {
    return this.session?.serviceType === 'friseur';
  }

  get companyName(): string {
    return this.session?.name || 'Unternehmen';
  }

  private updateValidators(): void {
    const peopleControl = this.bookingForm.get('people');
    const serviceControl = this.bookingForm.get('service');

    if (this.isSalon) {
      peopleControl?.clearValidators();
      serviceControl?.setValidators([Validators.required]);
      peopleControl?.setValue(1);
    } else {
      peopleControl?.setValidators([Validators.required, Validators.min(1)]);
      serviceControl?.clearValidators();
    }

    peopleControl?.updateValueAndValidity();
    serviceControl?.updateValueAndValidity();
  }

  private loadCompanyDetails(): void {
    const slug = this.session?.slug;
    if (!slug) {
      return;
    }
    this.companyService.getCompany(slug).subscribe({
      next: (company) => {
        this.company = company;
        this.refreshSlots();
      }
    });
  }

  private refreshSlots(): void {
    this.slots = this.generateSlots(this.selectedDateObj);
    const current = this.bookingForm.value.time ?? '';
    const available = this.slots.filter((slot) => !this.isSlotFull(slot) && !this.isSlotTooSoon(slot));
    if (!current || !this.slots.includes(current) || this.isSlotFull(current) || this.isSlotTooSoon(current)) {
      this.bookingForm.patchValue({ time: available[0] || '' }, { emitEvent: false });
    }
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

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getDateOffset(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private applySelectedDate(value: string): void {
    this.selectedDate = value;
    this.selectedDateObj = this.parseDate(value);
    this.bookingForm.patchValue({ date: value }, { emitEvent: false });
    this.refreshSlots();
    this.loadReservations();
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    return new Date(year, (month || 1) - 1, day || 1);
  }
}
