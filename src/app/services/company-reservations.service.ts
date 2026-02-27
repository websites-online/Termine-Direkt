import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { CompanyAuthService } from './company-auth.service';

export interface CompanyReservation {
  id: string;
  date: string;
  time: string;
  guestName?: string;
  guestEmail?: string;
  phone?: string;
  people?: number;
  note?: string;
  service?: string;
  createdAt?: string;
}

export interface CompanyReservationPayload {
  date: string;
  time: string;
  guestName: string;
  guestEmail?: string;
  phone?: string;
  people?: number;
  note?: string;
  service?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CompanyReservationsService {
  private readonly baseUrl = this.resolveBaseUrl();
  private readonly storageKeyPrefix = 'termine-direkt.company-reservations.';

  constructor(
    private readonly http: HttpClient,
    private readonly authService: CompanyAuthService
  ) {}

  listReservations(date: string): Observable<CompanyReservation[]> {
    if (this.isLocalMock()) {
      const slug = this.authService.getSession()?.slug;
      if (!slug) {
        return of([]);
      }
      const reservations = this.loadLocalReservations(slug).filter((item) => item.date === date);
      return of(this.sortReservations(reservations)).pipe(delay(200));
    }

    return this.http.get<CompanyReservation[]>(
      `${this.baseUrl}?date=${encodeURIComponent(date)}`,
      { headers: this.authHeaders() }
    );
  }

  createReservation(payload: CompanyReservationPayload): Observable<CompanyReservation> {
    if (this.isLocalMock()) {
      const slug = this.authService.getSession()?.slug;
      if (!slug) {
        return throwError(() => new Error('Nicht eingeloggt.'));
      }
      const reservations = this.loadLocalReservations(slug);
      const count = reservations.filter((item) => item.date === payload.date && item.time === payload.time).length;
      if (count >= 3) {
        return throwError(() => new Error('Slot voll.'));
      }
      const created: CompanyReservation = {
        id: `${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString()
      };
      reservations.push(created);
      this.saveLocalReservations(slug, reservations);
      return of(created).pipe(delay(200));
    }

    return this.http.post<CompanyReservation>(this.baseUrl, payload, { headers: this.authHeaders() });
  }

  deleteReservation(id: string): Observable<{ success: boolean }> {
    if (this.isLocalMock()) {
      const slug = this.authService.getSession()?.slug;
      if (!slug) {
        return throwError(() => new Error('Nicht eingeloggt.'));
      }
      const reservations = this.loadLocalReservations(slug).filter((item) => item.id !== id);
      this.saveLocalReservations(slug, reservations);
      return of({ success: true }).pipe(delay(200));
    }

    return this.http.delete<{ success: boolean }>(`${this.baseUrl}?id=${encodeURIComponent(id)}`, {
      headers: this.authHeaders()
    });
  }

  private resolveBaseUrl(): string {
    const baseUrl = environment.API_BASE_URL || '';
    if (typeof window !== 'undefined' && baseUrl.includes('localhost') && window.location.hostname !== 'localhost') {
      return '/api/company/reservations';
    }
    return baseUrl.length > 0 ? `${baseUrl}/api/company/reservations` : '/api/company/reservations';
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.getAuthToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  private isLocalMock(): boolean {
    return (
      environment.mockApi &&
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost'
    );
  }

  private loadLocalReservations(slug: string): CompanyReservation[] {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(`${this.storageKeyPrefix}${slug}`);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw) as CompanyReservation[];
    } catch {
      return [];
    }
  }

  private saveLocalReservations(slug: string, reservations: CompanyReservation[]): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(`${this.storageKeyPrefix}${slug}`, JSON.stringify(reservations));
  }

  private sortReservations(reservations: CompanyReservation[]): CompanyReservation[] {
    return [...reservations].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }
}
