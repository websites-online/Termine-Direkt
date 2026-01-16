import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { CompanyService } from '../../services/company.service';

@Component({
  selector: 'app-restaurant-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './restaurant-page.component.html',
  styleUrl: './restaurant-page.component.css'
})
export class RestaurantPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly companyService = inject(CompanyService);
  private readonly formBuilder = inject(FormBuilder);

  readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
  readonly company = this.companyService.findBySlug(this.slug);
  readonly slots = this.generateSlots();
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

  readonly bookingForm = this.formBuilder.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    people: [2, [Validators.required, Validators.min(1)]],
    note: [''],
    time: ['18:00', Validators.required]
  });

  submit(): void {
    this.successMessage = '';

    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    this.successMessage = 'Reservierung wurde simuliert.';
    this.bookingForm.reset({
      name: '',
      phone: '',
      people: 2,
      note: '',
      time: '18:00'
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
    const slots: string[] = [];
    let minutes = 12 * 60;
    const endMinutes = 20 * 60;

    while (minutes < endMinutes) {
      const hour = Math.floor(minutes / 60)
        .toString()
        .padStart(2, '0');
      const minute = (minutes % 60).toString().padStart(2, '0');
      slots.push(`${hour}:${minute}`);
      minutes += 45;
    }

    return slots;
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
}
