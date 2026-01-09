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
  readonly slots = this.generateSlots();
  readonly slotCapacity = 3;
  private readonly bookings: Record<string, number> = {};
  successMessage = '';
  errorMessage = '';

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

    const time = this.bookingForm.value.time ?? '';
    const currentCount = this.bookings[time] ?? 0;

    if (currentCount >= this.slotCapacity) {
      this.errorMessage = 'Dieses Zeitfenster ist bereits ausgebucht.';
      return;
    }

    this.bookings[time] = currentCount + 1;
    this.successMessage = 'Demo: Reservierung wurde simuliert.';
    this.errorMessage = '';
    this.bookingForm.reset({
      name: '',
      phone: '',
      people: 2,
      time: '12:00'
    });
  }

  getRemainingSlots(time: string): number {
    const booked = this.bookings[time] ?? 0;
    return Math.max(this.slotCapacity - booked, 0);
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
