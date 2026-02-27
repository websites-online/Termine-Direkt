import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { CompanyAuthService } from '../../services/company-auth.service';

@Component({
  selector: 'app-company-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule],
  templateUrl: './company-login.component.html',
  styleUrl: './company-login.component.css'
})
export class CompanyLoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  isSubmitting = false;
  errorMessage = '';

  readonly loginForm = this.formBuilder.group({
    slug: ['', [Validators.required]],
    pin: ['', [Validators.required, Validators.minLength(6)]]
  });

  constructor(
    private readonly authService: CompanyAuthService,
    private readonly router: Router
  ) {}

  submit(): void {
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const slug = this.loginForm.value.slug ?? '';
    const pin = this.loginForm.value.pin ?? '';

    this.isSubmitting = true;

    this.authService.login(slug.trim(), pin.trim()).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigate(['/unternehmen']);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.message || 'Login fehlgeschlagen.';
      }
    });
  }
}
