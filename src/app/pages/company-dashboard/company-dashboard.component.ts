import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { CompanyAuthService, CompanySession } from '../../services/company-auth.service';
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
  reservations: CompanyReservation[] = [];
  selectedDate = this.getToday();
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
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.session = this.authService.getSession();
    this.updateValidators();
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
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.listError = 'Buchungen konnten nicht geladen werden.';
      }
    });
  }

  onDateChange(): void {
    this.loadReservations();
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

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
