import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-demo-unternehmen',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './demo-unternehmen.component.html',
  styleUrl: './demo-unternehmen.component.css'
})
export class DemoUnternehmenComponent {
  private readonly formBuilder = inject(FormBuilder);
  successMessage = '';
  readonly slots = this.generateSlots();
  readonly weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  readonly calendarDays = this.generateCalendar(2026, 2, 26);
  selectedDate = '26. März 2026';

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

    this.successMessage = 'Demo: Reservierung wurde simuliert.';
    this.bookingForm.reset({
      name: '',
      phone: '',
      people: 2,
      note: '',
      time: '18:00'
    });
  }

  selectDate(day: number): void {
    this.selectedDate = `${day}. März 2026`;
    this.calendarDays.forEach((entry) => {
      entry.active = entry.label === day;
    });
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
  ): Array<{ label: number; muted: boolean; active: boolean }> {
    const firstDay = new Date(year, monthIndex, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();
    const cells: Array<{ label: number; muted: boolean; active: boolean }> = [];

    for (let i = 0; i < 42; i += 1) {
      if (i < startOffset) {
        const label = daysInPrevMonth - startOffset + i + 1;
        cells.push({ label, muted: true, active: false });
        continue;
      }

      const dayNumber = i - startOffset + 1;
      if (dayNumber <= daysInMonth) {
        cells.push({
          label: dayNumber,
          muted: false,
          active: dayNumber === activeDay
        });
        continue;
      }

      const label = dayNumber - daysInMonth;
      cells.push({ label, muted: true, active: false });
    }

    return cells;
  }
}
