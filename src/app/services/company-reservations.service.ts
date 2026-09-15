import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { CompanyAuthService } from './company-auth.service';

export interface CompanyReservation {
  id: string;
  date: string;
  time: string;
  requestedDate?: string;
  requestedTime?: string;
  guestName?: string;
  guestEmail?: string;
  phone?: string;
  people?: number;
  note?: string;
  service?: string;
  stylist?: string;
  isBlock?: boolean;
  isInternal?: boolean;
  isRequest?: boolean;
  requestStatus?: 'pending' | 'approved' | string;
  proposedDate?: string;
  proposedTime?: string;
  alternativeSentAt?: string;
  alternativeExpiresAt?: string;
  confirmationEmailSent?: boolean;
  warning?: string;
  blockId?: string;
  createdAt?: string;
}

export interface AlternativeSuggestion {
  date: string;
  time: string;
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
  stylist?: string;
  isBlock?: boolean;
  blockCapacity?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CompanyReservationsService {
  private readonly baseUrl = this.resolveBaseUrl();
  private readonly storageKeyPrefix = 'termine-direkt.company-reservations.';

  constructor(
    private readonly http: HttpClient,
    private readonly authService: CompanyAuthService,
  ) {}

  listReservations(date: string): Observable<CompanyReservation[]> {
    if (this.isLocalMock()) {
      const slug = this.authService.getSession()?.slug;
      if (!slug) {
        return of([]);
      }
      const reservations = this.loadLocalReservations(slug)
        .map((item) => this.toLocalDisplayReservation(item))
        .filter((item) => item.date === date);
      return of(this.sortReservations(reservations)).pipe(delay(200));
    }

    return this.http.get<CompanyReservation[]>(`${this.baseUrl}?date=${encodeURIComponent(date)}`, {
      headers: this.authHeaders(),
    });
  }

  listReservationsRange(startDate: string, endDate: string): Observable<CompanyReservation[]> {
    if (this.isLocalMock()) {
      const slug = this.authService.getSession()?.slug;
      if (!slug) {
        return of([]);
      }
      const reservations = this.loadLocalReservations(slug)
        .map((item) => this.toLocalDisplayReservation(item))
        .filter((item) => item.date >= startDate && item.date <= endDate);
      return of(this.sortReservations(reservations)).pipe(delay(200));
    }

    const query = new URLSearchParams({ startDate, endDate });
    return this.http.get<CompanyReservation[]>(`${this.baseUrl}?${query.toString()}`, {
      headers: this.authHeaders(),
    });
  }

  createReservation(payload: CompanyReservationPayload): Observable<CompanyReservation> {
    if (this.isLocalMock()) {
      const slug = this.authService.getSession()?.slug;
      if (!slug) {
        return throwError(() => new Error('Nicht eingeloggt.'));
      }
      const reservations = this.loadLocalReservations(slug);
      const blockCapacity = Math.min(Math.max(Number(payload.blockCapacity || 3), 1), 3);
      const count = reservations.reduce((total, item) => {
        if (item.date !== payload.date || item.time !== payload.time) {
          return total;
        }
        return total + (item.isBlock ? blockCapacity : 1);
      }, 0);
      if (count >= blockCapacity) {
        return throwError(() => new Error('Slot voll.'));
      }
      const created: CompanyReservation = {
        id: `${Date.now()}`,
        ...payload,
        isInternal: true,
        blockId: payload.isBlock ? `local-${Date.now()}` : undefined,
        createdAt: new Date().toISOString(),
      };
      reservations.push(created);
      this.saveLocalReservations(slug, reservations);
      return of(created).pipe(delay(200));
    }

    return this.http.post<CompanyReservation>(this.baseUrl, payload, {
      headers: this.authHeaders(),
    });
  }

  approveRequest(id: string): Observable<CompanyReservation> {
    if (this.isLocalMock()) {
      const slug = this.authService.getSession()?.slug;
      if (!slug) {
        return throwError(() => new Error('Nicht eingeloggt.'));
      }
      const reservations = this.loadLocalReservations(slug);
      const index = reservations.findIndex((item) => item.id === id && item.isRequest);
      if (index === -1) {
        return throwError(() => new Error('Anfrage nicht gefunden.'));
      }
      const approved: CompanyReservation = {
        ...reservations[index],
        isRequest: false,
        requestStatus: 'approved',
        confirmationEmailSent: true,
      };
      reservations[index] = approved;
      this.saveLocalReservations(slug, reservations);
      return of(approved).pipe(delay(200));
    }

    return this.http.patch<CompanyReservation>(
      this.baseUrl,
      { id, action: 'approve' },
      { headers: this.authHeaders() },
    );
  }

  getAlternativeSuggestions(id: string): Observable<AlternativeSuggestion[]> {
    if (this.isLocalMock()) {
      const slug = this.authService.getSession()?.slug;
      if (!slug) {
        return throwError(() => new Error('Nicht eingeloggt.'));
      }
      const reservations = this.loadLocalReservations(slug);
      const request = reservations.find((item) => item.id === id && item.isRequest);
      if (!request) {
        return throwError(() => new Error('Anfrage nicht gefunden.'));
      }
      const suggestions: AlternativeSuggestion[] = [];
      let date = request.date;
      let minutes = this.toMinutes(request.time) + 60;
      for (let attempts = 0; attempts < 40 && suggestions.length < 3; attempts += 1) {
        if (minutes >= 19 * 60) {
          date = this.addDays(date, 1);
          minutes = 9 * 60;
        }
        const time = this.formatTime(minutes);
        const occupied = reservations.some(
          (item) =>
            item.date === date &&
            item.time === time &&
            (!item.isRequest ||
              (item.requestStatus === 'alternative_sent' &&
                new Date(item.alternativeExpiresAt || 0).getTime() > Date.now())),
        );
        if (!occupied) {
          suggestions.push({ date, time });
        }
        minutes += 60;
      }
      return of(suggestions).pipe(delay(250));
    }

    const query = new URLSearchParams({ action: 'suggestions', requestId: id });
    return new Observable<AlternativeSuggestion[]>((subscriber) => {
      this.http
        .get<{ suggestions: AlternativeSuggestion[] }>(`${this.baseUrl}?${query.toString()}`, {
          headers: this.authHeaders(),
        })
        .subscribe({
          next: (result) => {
            subscriber.next(result.suggestions || []);
            subscriber.complete();
          },
          error: (error) => subscriber.error(error),
        });
    });
  }

  offerAlternative(id: string, date: string, time: string): Observable<CompanyReservation> {
    if (this.isLocalMock()) {
      const slug = this.authService.getSession()?.slug;
      if (!slug) {
        return throwError(() => new Error('Nicht eingeloggt.'));
      }
      const reservations = this.loadLocalReservations(slug);
      const index = reservations.findIndex((item) => item.id === id && item.isRequest);
      if (index === -1) {
        return throwError(() => new Error('Anfrage nicht gefunden.'));
      }
      const sentAt = new Date();
      const updated: CompanyReservation = {
        ...reservations[index],
        requestStatus: 'alternative_sent',
        proposedDate: date,
        proposedTime: time,
        alternativeSentAt: sentAt.toISOString(),
        alternativeExpiresAt: new Date(sentAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      };
      reservations[index] = updated;
      this.saveLocalReservations(slug, reservations);
      return of(updated).pipe(delay(300));
    }

    return this.http.patch<CompanyReservation>(
      this.baseUrl,
      { id, action: 'offer_alternative', date, time },
      { headers: this.authHeaders() },
    );
  }

  deleteReservation(id: string): Observable<{ success: boolean }> {
    if (this.isLocalMock()) {
      const slug = this.authService.getSession()?.slug;
      if (!slug) {
        return throwError(() => new Error('Nicht eingeloggt.'));
      }
      const existing = this.loadLocalReservations(slug);
      const target = existing.find((item) => item.id === id);
      const reservations = existing.filter(
        (item) => item.id !== id && (!target?.blockId || item.blockId !== target.blockId),
      );
      this.saveLocalReservations(slug, reservations);
      return of({ success: true }).pipe(delay(200));
    }

    return this.http.delete<{ success: boolean }>(`${this.baseUrl}?id=${encodeURIComponent(id)}`, {
      headers: this.authHeaders(),
    });
  }

  private resolveBaseUrl(): string {
    const baseUrl = environment.API_BASE_URL || '';
    if (
      typeof window !== 'undefined' &&
      baseUrl.includes('localhost') &&
      window.location.hostname !== 'localhost'
    ) {
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
    return [...reservations].sort((a, b) =>
      `${a.date || ''}-${a.time || ''}`.localeCompare(`${b.date || ''}-${b.time || ''}`),
    );
  }

  private toLocalDisplayReservation(item: CompanyReservation): CompanyReservation {
    const hasActiveAlternative =
      item.isRequest &&
      item.requestStatus === 'alternative_sent' &&
      Boolean(item.proposedDate && item.proposedTime) &&
      new Date(item.alternativeExpiresAt || 0).getTime() > Date.now();
    return hasActiveAlternative
      ? {
          ...item,
          requestedDate: item.requestedDate || item.date,
          requestedTime: item.requestedTime || item.time,
          date: item.proposedDate || item.date,
          time: item.proposedTime || item.time,
        }
      : item;
  }

  private toMinutes(time: string): number {
    const [hour, minute] = String(time || '09:00')
      .split(':')
      .map(Number);
    return hour * 60 + (minute || 0);
  }

  private formatTime(minutes: number): string {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  private addDays(dateValue: string, amount: number): string {
    const date = new Date(`${dateValue}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }
}
