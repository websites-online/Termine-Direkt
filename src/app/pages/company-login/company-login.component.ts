import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { environment } from '../../../environments/environment';
import { CompanyAuthService } from '../../services/company-auth.service';

@Component({
  selector: 'app-company-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule],
  templateUrl: './company-login.component.html',
  styleUrl: './company-login.component.css',
})
export class CompanyLoginComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  isSubmitting = false;
  errorMessage = '';
  readonly isLocalDemoAvailable =
    environment.mockApi &&
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost';

  readonly loginForm = this.formBuilder.group({
    slug: ['', [Validators.required]],
    pin: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor(
    private readonly authService: CompanyAuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    if (this.isLocalDemoAvailable && this.route.snapshot.queryParamMap.get('demo') === 'pro') {
      this.openProDemo();
    }
  }

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
      },
    });
  }

  openProDemo(): void {
    this.errorMessage = '';
    this.isSubmitting = true;
    this.authService.login('new-city-barber-demo', '123456').subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigate(['/unternehmen/statistik']);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.message || 'Demo konnte nicht geöffnet werden.';
      },
    });
  }
}
