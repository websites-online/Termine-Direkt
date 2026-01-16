import { Component, OnInit, inject } from '@angular/core';
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
export class AdminDashboardComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  companies: Company[] = [];
  readonly companyForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: ['Beispielstraße 12, 12345 Musterstadt', Validators.required],
    hours: ['Mo–So 12:00–20:00', Validators.required],
    email: ['kontakt@example.com']
  });

  constructor(
    private readonly authService: AdminAuthService,
    private readonly router: Router,
    private readonly companyService: CompanyService
  ) {}

  ngOnInit(): void {
    this.loadCompanies();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  createCompany(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }

    const value = this.companyForm.value;
    this.companyService.addCompany({
      name: value.name || 'Neues Unternehmen',
      address: value.address || 'Beispielstraße 12, 12345 Musterstadt',
      hours: value.hours || 'Mo–So 12:00–20:00',
      email: value.email || undefined
    });
    this.companyForm.markAsPristine();
    this.loadCompanies();
  }

  deleteCompany(slug: string): void {
    const confirmed = window.confirm('Unternehmen wirklich löschen?');
    if (!confirmed) {
      return;
    }
    this.companyService.deleteCompany(slug);
    this.loadCompanies();
  }

  private loadCompanies(): void {
    this.companies = this.companyService.getCompanies();
  }
}
