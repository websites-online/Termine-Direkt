import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AdminAuthService } from '../../services/admin-auth.service';
import { Company, CompanyApiService } from '../../services/company-api.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  companies: Company[] = [];
  editingSlug: string | null = null;
  readonly companyForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: ['Beispielstraße 12, 12345 Musterstadt', Validators.required],
    hours: ['Mo–So 12:00–20:00', Validators.required],
    breakHours: [''],
    email: ['kontakt@example.com', [Validators.required, Validators.email]],
    serviceType: ['restaurant', Validators.required],
    loginPin: ['']
  });

  constructor(
    private readonly authService: AdminAuthService,
    private readonly router: Router,
    private readonly companyService: CompanyApiService
  ) {}

  ngOnInit(): void {
    this.resetForm();
    this.loadCompanies();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  submitCompany(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }

    const value = this.companyForm.value;
    const payload = {
      name: value.name || 'Neues Unternehmen',
      address: value.address || 'Beispielstraße 12, 12345 Musterstadt',
      hours: value.hours || 'Mo–So 12:00–20:00',
      breakHours: value.breakHours || undefined,
      email: value.email || 'kontakt@example.com',
      serviceType: (value.serviceType || 'restaurant') as 'restaurant' | 'friseur',
      loginPin: value.loginPin?.trim() || undefined
    };

    const request$ = this.editingSlug
      ? this.companyService.updateCompany(this.editingSlug, payload)
      : this.companyService.createCompany(payload);
    request$.subscribe({
      next: () => {
        this.resetForm();
        this.loadCompanies();
      }
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
      serviceType: company.serviceType || 'restaurant',
      loginPin: ''
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  deleteCompany(slug: string): void {
    const confirmed = window.confirm('Unternehmen wirklich löschen?');
    if (!confirmed) {
      return;
    }
    this.companyService.deleteCompany(slug).subscribe({
      next: () => this.loadCompanies()
    });
  }

  private loadCompanies(): void {
    this.companyService.listCompanies().subscribe({
      next: (companies) => {
        this.companies = companies;
      }
    });
  }

  private resetForm(): void {
    this.editingSlug = null;
    this.companyForm.reset({
      name: '',
      address: 'Beispielstraße 12, 12345 Musterstadt',
      hours: 'Mo–So 12:00–20:00',
      breakHours: '',
      email: 'kontakt@example.com',
      serviceType: 'restaurant',
      loginPin: this.createRandomPin()
    });
    this.companyForm.markAsPristine();
  }

  generateLoginPin(): void {
    this.companyForm.patchValue({ loginPin: this.createRandomPin() });
    this.companyForm.markAsDirty();
  }

  private createRandomPin(): string {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
  }
}
