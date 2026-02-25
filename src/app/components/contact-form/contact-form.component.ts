import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ContactPayload, ContactService } from '../../services/contact.service';

@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.css'
})
export class ContactFormComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly contactForm = this.formBuilder.group({
    serviceType: ['restaurant', [Validators.required]],
    companyName: [''],
    contactName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    location: [''],
    plan: ['starter', [Validators.required]],
    message: ['', [Validators.required]],
    acceptedPrivacy: [false, [Validators.requiredTrue]]
  });

  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  constructor(private readonly contactService: ContactService) {}

  submit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      this.errorMessage = 'Bitte Pflichtfelder ausfüllen und Datenschutz bestätigen.';
      return;
    }

    this.isSubmitting = true;

    const payload: ContactPayload = {
      serviceType: (this.contactForm.value.serviceType || 'restaurant') as 'restaurant' | 'friseur',
      companyName: this.contactForm.value.companyName || undefined,
      contactName: this.contactForm.value.contactName ?? '',
      email: this.contactForm.value.email ?? '',
      phone: this.contactForm.value.phone || undefined,
      plan: (this.contactForm.value.plan || undefined) as 'test' | 'starter' | 'pro' | undefined,
      location: this.contactForm.value.location || undefined,
      message: this.contactForm.value.message ?? '',
      acceptedPrivacy: true
    };

    this.contactService.sendContactMessage(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = 'Danke! Ihre Nachricht wurde gesendet.';
        this.contactForm.reset({
          serviceType: 'restaurant',
          companyName: '',
          contactName: '',
          email: '',
          phone: '',
          location: '',
          plan: 'starter',
          message: '',
          acceptedPrivacy: false
        });
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'Senden fehlgeschlagen. Bitte später erneut versuchen.';
      }
    });
  }

  get contactName() {
    return this.contactForm.get('contactName');
  }

  get email() {
    return this.contactForm.get('email');
  }

  get message() {
    return this.contactForm.get('message');
  }

  get acceptedPrivacy() {
    return this.contactForm.get('acceptedPrivacy');
  }

  get isSalonLead(): boolean {
    return this.contactForm.value.serviceType === 'friseur';
  }

  get companyLabel(): string {
    return this.isSalonLead ? 'Salonname (optional)' : 'Firmenname (optional)';
  }

  get companyPlaceholder(): string {
    return this.isSalonLead ? 'Salonname' : 'Restaurantname';
  }

  get emailPlaceholder(): string {
    return this.isSalonLead ? 'name@friseur.de' : 'name@restaurant.de';
  }

  get serviceType() {
    return this.contactForm.get('serviceType');
  }
}
