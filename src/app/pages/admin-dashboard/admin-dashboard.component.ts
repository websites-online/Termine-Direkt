import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AdminAuthService } from '../../services/admin-auth.service';
import { Company, CompanyService } from '../../services/company.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);

  companies: Company[] = this.companyService.getCompanies();

  readonly companyForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2)]]
  });

  readonly dateFormatter = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium'
  });

  constructor(
    private readonly authService: AdminAuthService,
    private readonly router: Router
  ) {}

  createCompany(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }

    const name = this.companyForm.value.name?.trim() ?? '';
    if (!name) {
      return;
    }

    const company = this.companyService.addCompany(name);
    this.companies = this.companyService.getCompanies();
    this.companyForm.reset({ name: '' });
    this.router.navigate(['/r', company.slug], { state: { companyName: company.name } });
  }

  deleteCompany(slug: string): void {
    const confirmed = window.confirm('Unternehmen wirklich löschen?');
    if (!confirmed) {
      return;
    }

    this.companyService.deleteCompany(slug);
    this.companies = this.companyService.getCompanies();
  }

  formatDate(value: string): string {
    return this.dateFormatter.format(new Date(value));
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
