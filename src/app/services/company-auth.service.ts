import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, delay, map, of, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { Company } from './company-api.service';

export interface CompanySession {
  token: string;
  slug: string;
  name: string;
  email: string;
  serviceType: 'restaurant' | 'friseur';
}

@Injectable({
  providedIn: 'root'
})
export class CompanyAuthService {
  private readonly tokenKey = 'company_token';
  private readonly sessionKey = 'company_session';
  private readonly loginUrl = this.resolveLoginUrl();

  constructor(private readonly http: HttpClient) {}

  login(slug: string, pin: string): Observable<CompanySession> {
    if (this.isLocalMock()) {
      const companies = this.loadLocalCompanies();
      const company = companies.find((item) => item.slug === slug);
      if (!company) {
        return throwError(() => new Error('Unternehmen nicht gefunden.'));
      }
      if (!company.loginPin || company.loginPin !== pin) {
        return throwError(() => new Error('Ungültiger PIN.'));
      }
      const session: CompanySession = {
        token: btoa(`${slug}:${pin}`),
        slug: company.slug,
        name: company.name,
        email: company.email,
        serviceType: (company.serviceType || 'restaurant') as 'restaurant' | 'friseur'
      };
      this.storeSession(session);
      return of(session).pipe(delay(200));
    }

    return this.http
      .post<{ token: string; company: CompanySession }>(this.loginUrl, { slug, pin })
      .pipe(
        map((response) => {
          const session = response.company?.token
            ? response.company
            : { ...response.company, token: response.token };
          this.storeSession(session);
          return session;
        })
      );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.sessionKey);
  }

  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem(this.tokenKey));
  }

  getSession(): CompanySession | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const raw = window.localStorage.getItem(this.sessionKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as CompanySession;
    } catch {
      return null;
    }
  }

  getAuthToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private resolveLoginUrl(): string {
    const baseUrl = environment.API_BASE_URL || '';
    if (typeof window !== 'undefined' && baseUrl.includes('localhost') && window.location.hostname !== 'localhost') {
      return '/api/company/login';
    }
    return baseUrl.length > 0 ? `${baseUrl}/api/company/login` : '/api/company/login';
  }

  private storeSession(session: CompanySession): void {
    localStorage.setItem(this.tokenKey, session.token);
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
  }

  private isLocalMock(): boolean {
    return (
      environment.mockApi &&
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost'
    );
  }

  private loadLocalCompanies(): Company[] {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const raw = window.localStorage.getItem('termine-direkt.companies');
      if (!raw) {
        return [];
      }
      return JSON.parse(raw) as Company[];
    } catch {
      return [];
    }
  }
}
