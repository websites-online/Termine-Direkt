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
  message: string;
  acceptedPrivacy: true;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private readonly contactUrl = `${environment.API_BASE_URL}/api/public/contact`;

  constructor(private readonly http: HttpClient) {}

  sendContactMessage(payload: ContactPayload): Observable<{ success: boolean }> {
    if (environment.mockApi) {
      // TODO: Backend Endpoint required
      return of({ success: true }).pipe(delay(600));
    }

    return this.http.post<{ success: boolean }>(this.contactUrl, payload);
  }
}
