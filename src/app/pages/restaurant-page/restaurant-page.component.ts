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
  readonly weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  readonly calendarDays = this.generateCalendar(2026, 2, 26);
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
