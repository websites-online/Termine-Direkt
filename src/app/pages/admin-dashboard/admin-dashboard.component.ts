import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AdminAuthService } from '../../services/admin-auth.service';
import { Company, CompanyApiService, TimeSelectionMode } from '../../services/company-api.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  companies: Company[] = [];
  editingSlug: string | null = null;
  readonly standaloneEditSlug: string | null;
  isSaving = false;
  formError = '';
  formSuccess = '';
  readonly companyForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: ['Beispielstraße 12, 12345 Musterstadt', Validators.required],
    hours: ['Mo–So 12:00–20:00', Validators.required],
    breakHours: [''],
    email: ['kontakt@example.com', [Validators.required, Validators.email]],
    splitServiceEmails: [false],
    womenServicesEmail: [''],
    serviceType: ['restaurant', Validators.required],
    bookingMode: ['confirm', Validators.required],
    seatingOptionsEnabled: [false],
    stylistSelectionEnabled: [false],
    stylistsText: [''],
    loginPin: [''],
    slotCapacity: [3, [Validators.required, Validators.min(1), Validators.max(3)]],
    slotIntervalMinutes: [45, Validators.required],
    bookingBufferMinutes: [120, [Validators.required, Validators.min(0), Validators.max(1440)]],
    timeSelectionMode: ['slots', Validators.required],
  });

  constructor(
    private readonly authService: AdminAuthService,
    private readonly router: Router,
    private readonly companyService: CompanyApiService,
    private readonly route: ActivatedRoute,
  ) {
    this.standaloneEditSlug = this.route.snapshot.paramMap.get('slug');
  }

  ngOnInit(): void {
    this.resetForm();
    this.companyForm.valueChanges.subscribe(() => this.updateWomenServicesEmailValidators());
    this.updateWomenServicesEmailValidators();
    this.loadCompanies();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  submitCompany(): void {
    this.formError = '';
    this.formSuccess = '';
    this.updateWomenServicesEmailValidators();
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }

    const value = this.companyForm.value;
    const serviceType = (value.serviceType || 'restaurant') as 'restaurant' | 'friseur';
    const splitServiceEmails = serviceType === 'friseur' && value.splitServiceEmails === true;
    const stylists = this.parseStylistNames(value.stylistsText);
    const payload = {
      name: value.name || 'Neues Unternehmen',
      address: value.address || 'Beispielstraße 12, 12345 Musterstadt',
      hours: value.hours || 'Mo–So 12:00–20:00',
      breakHours: value.breakHours || undefined,
      email: value.email || 'kontakt@example.com',
      splitServiceEmails,
      womenServicesEmail: splitServiceEmails
        ? value.womenServicesEmail?.trim() || undefined
        : undefined,
      serviceType,
      bookingMode: (value.bookingMode || 'confirm') as 'confirm' | 'request',
      seatingOptionsEnabled: serviceType === 'restaurant' && value.seatingOptionsEnabled === true,
      stylistSelectionEnabled:
        serviceType === 'friseur' && value.stylistSelectionEnabled === true && stylists.length > 0,
      stylists: serviceType === 'friseur' ? stylists : [],
      loginPin: value.loginPin?.trim() || undefined,
      slotCapacity: Number(value.slotCapacity || 3),
      slotIntervalMinutes: Number(value.slotIntervalMinutes || 45) as 30 | 45 | 60,
      bookingBufferMinutes: Number(value.bookingBufferMinutes ?? 120),
      timeSelectionMode: (value.timeSelectionMode || 'slots') as TimeSelectionMode,
    };

    const request$ = this.editingSlug
      ? this.companyService.updateCompany(this.editingSlug, payload)
      : this.companyService.createCompany(payload);
    this.isSaving = true;
    request$.subscribe({
      next: (company) => {
        this.isSaving = false;
        if (this.standaloneEditSlug) {
          this.editingSlug = company.slug;
          this.formSuccess = 'Alle Änderungen wurden gespeichert.';
          if (company.slug !== this.standaloneEditSlug) {
            this.router.navigate(['/admin/unternehmen', company.slug], { replaceUrl: true });
          }
          return;
        }
        this.resetForm();
        this.loadCompanies();
      },
      error: (error) => {
        this.isSaving = false;
        this.formError =
          error?.error?.error ||
          'Speichern fehlgeschlagen. Bitte Supabase-Spalten prüfen und erneut versuchen.';
      },
    });
  }

  startEdit(company: Company): void {
    this.editingSlug = company.slug;
    this.companyForm.patchValue({
      name: company.name,
      address: company.address,
      hours: company.hours,
      breakHours: company.breakHours || '',
      email: company.email,
      splitServiceEmails: company.splitServiceEmails || false,
      womenServicesEmail: company.womenServicesEmail || '',
      serviceType: company.serviceType || 'restaurant',
      bookingMode: company.bookingMode || 'confirm',
      seatingOptionsEnabled: company.seatingOptionsEnabled || false,
      stylistSelectionEnabled: company.stylistSelectionEnabled || false,
      stylistsText: (company.stylists || []).join('\n'),
      loginPin: '',
      slotCapacity: company.slotCapacity ?? 3,
      slotIntervalMinutes: company.slotIntervalMinutes ?? 45,
      bookingBufferMinutes: company.bookingBufferMinutes ?? 120,
      timeSelectionMode: company.timeSelectionMode || 'slots',
    });
    this.updateWomenServicesEmailValidators();
  }

  cancelEdit(): void {
    if (this.standaloneEditSlug) {
      this.router.navigate(['/admin']);
      return;
    }
    this.resetForm();
  }

  formatBookingBufferMinutes(value: number | undefined): string {
    const minutes = Number(value ?? 120);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return 'Sofort';
    }
    if (minutes % 60 === 0) {
      const hours = minutes / 60;
      return hours === 1 ? '1 Stunde' : `${hours} Stunden`;
    }
    return `${minutes} Minuten`;
  }

  deleteCompany(slug: string): void {
    const confirmed = window.confirm('Unternehmen wirklich löschen?');
    if (!confirmed) {
      return;
    }
    this.companyService.deleteCompany(slug).subscribe({
      next: () => this.loadCompanies(),
    });
  }

  private loadCompanies(): void {
    this.companyService.listCompanies().subscribe({
      next: (companies) => {
        this.companies = companies;
        if (this.standaloneEditSlug) {
          const company = companies.find((item) => item.slug === this.standaloneEditSlug);
          if (company) {
            this.startEdit(company);
          } else {
            this.formError = 'Das Unternehmen wurde nicht gefunden.';
          }
        }
      },
    });
  }

  private resetForm(): void {
    this.editingSlug = null;
    this.formError = '';
    this.formSuccess = '';
    this.companyForm.reset({
      name: '',
      address: 'Beispielstraße 12, 12345 Musterstadt',
      hours: 'Mo–So 12:00–20:00',
      breakHours: '',
      email: 'kontakt@example.com',
      splitServiceEmails: false,
      womenServicesEmail: '',
      serviceType: 'restaurant',
      bookingMode: 'confirm',
      seatingOptionsEnabled: false,
      stylistSelectionEnabled: false,
      stylistsText: '',
      loginPin: this.createRandomPin(),
      slotCapacity: 3,
      slotIntervalMinutes: 45,
      bookingBufferMinutes: 120,
      timeSelectionMode: 'slots',
    });
    this.updateWomenServicesEmailValidators();
    this.companyForm.markAsPristine();
  }

  generateLoginPin(): void {
    this.companyForm.patchValue({ loginPin: this.createRandomPin() });
    this.companyForm.markAsDirty();
  }

  private createRandomPin(): string {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
  }

  private parseStylistNames(value: unknown): string[] {
    return Array.from(
      new Set(
        String(value || '')
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    );
  }

  private updateWomenServicesEmailValidators(): void {
    const control = this.companyForm.get('womenServicesEmail');
    if (!control) {
      return;
    }
    const splitServiceEmails =
      this.companyForm.value.serviceType === 'friseur' &&
      this.companyForm.value.splitServiceEmails === true;
    if (splitServiceEmails) {
      control.setValidators([Validators.required, Validators.email]);
    } else {
      control.clearValidators();
      control.setErrors(null);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }
}
