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
  selectedDate = '04. März 2026';
  successMessage = '';

  readonly bookingForm = this.formBuilder.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    people: [2, [Validators.required, Validators.min(1)]],
    time: ['12:00', Validators.required]
  });

  submit(): void {
    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    this.successMessage = 'Reservierung wurde simuliert.';
    this.bookingForm.reset({
      name: '',
      phone: '',
      people: 2,
      time: '12:00'
    });
  }

  selectDate(value: string): void {
    this.selectedDate = value;
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
}
