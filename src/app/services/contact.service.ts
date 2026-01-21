import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';

import { environment } from '../../environments/environment';

export interface ContactPayload {
  companyName?: string;
  contactName: string;
  email: string;
  phone?: string;
  plan?: 'test' | 'starter' | 'pro';
  location?: string;
  message: string;
  acceptedPrivacy: true;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private readonly contactUrl = this.resolveContactUrl();

  private resolveContactUrl(): string {
    const baseUrl = environment.API_BASE_URL || '';
    if (typeof window !== 'undefined' && baseUrl.includes('localhost') && window.location.hostname !== 'localhost') {
      return '/api/contact';
    }
    return baseUrl.length > 0 ? `${baseUrl}/api/contact` : '/api/contact';
  }

  constructor(private readonly http: HttpClient) {}

  sendContactMessage(payload: ContactPayload): Observable<{ success: boolean }> {
    if (environment.mockApi) {
      // TODO: Backend Endpoint required
      return of({ success: true }).pipe(delay(600));
    }

    return this.http.post<{ success: boolean }>(this.contactUrl, payload);
  }
}
