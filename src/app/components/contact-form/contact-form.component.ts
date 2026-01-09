import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ContactPayload, ContactService } from '../../services/contact.service';

@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.css'
})
export class ContactFormComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly contactForm = this.formBuilder.group({
    companyName: [''],
    contactName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    serviceType: ['reservierungsseite', [Validators.required]],
    message: ['', [Validators.required]],
    acceptedPrivacy: [true]
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
      return;
    }

    this.isSubmitting = true;

    const serviceType =
      this.contactForm.value.serviceType === 'website' ? 'website' : 'reservierungsseite';

    const payload: ContactPayload = {
      companyName: this.contactForm.value.companyName || undefined,
      contactName: this.contactForm.value.contactName ?? '',
      email: this.contactForm.value.email ?? '',
      phone: this.contactForm.value.phone || undefined,
      serviceType,
      message: this.contactForm.value.message ?? '',
      acceptedPrivacy: true as const
    };

    this.contactService.submitContact(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = 'Danke! Ihre Nachricht wurde gesendet.';
        this.contactForm.reset({
          companyName: '',
          contactName: '',
          email: '',
          phone: '',
          serviceType: 'reservierungsseite',
          message: '',
          acceptedPrivacy: true
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

  get serviceType() {
    return this.contactForm.get('serviceType');
  }
}
