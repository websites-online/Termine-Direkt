import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  BookingLocation, HomeVisitAddress, bookingLocationNoteParts,
  extractBookingLocation, hasMobileService, normalizeHomeVisitAddress,
} from '../shared/booking-location';
import { Company } from './company-api.service';
import { CompanyReservation } from './company-reservations.service';

export interface PublicBookingPayload {
  restaurantName: string;
  restaurantSlug: string;
  restaurantEmail: string;
  serviceType: string;
  guestEmail: string;
  guestName: string;
  date: string;
  time: string;
  people: number;
  phone: string;
  note: string;
  service?: string;
  serviceValue?: string;
  serviceAudience?: string;
  stylist?: string;
  employeeId?: string;
  seating?: string;
  bookingLocation?: BookingLocation;
  homeVisitAddress?: HomeVisitAddress;
}

@Injectable({ providedIn: 'root' })
export class PublicBookingService {
  constructor(private readonly http: HttpClient) {}

  get isLocalPreview(): boolean {
    return environment.mockApi && typeof window !== 'undefined' &&
      window.location.hostname === 'localhost';
  }

  availability(company: Company, date: string, query: URLSearchParams):
    Observable<{ slots: Record<string, number> }> {
    if (!this.isLocalPreview || !hasMobileService(company.slug, company.serviceType)) {
      return this.http.get<{ slots: Record<string, number> }>(`/api/reservations?${query}`);
    }
    const slots: Record<string, number> = {};
    this.loadLocalReservations(company.slug)
      .filter((item) => item.date === date && !item.isRequest)
      .forEach((item) => {
        slots[item.time] = (slots[item.time] || 0) + (item.isBlock ? company.slotCapacity || 3 : 1);
      });
    return of({ slots }).pipe(delay(100));
  }

  submit(company: Company, payload: PublicBookingPayload):
    Observable<{ success: boolean; requestMode?: boolean }> {
    if (!this.isLocalPreview || !hasMobileService(company.slug, company.serviceType)) {
      return this.http.post<{ success: boolean; requestMode?: boolean }>('/api/reservations', payload);
    }
    const mobileEnabled = hasMobileService(company.slug, company.serviceType);
    const address = normalizeHomeVisitAddress(payload.homeVisitAddress);
    if (payload.bookingLocation === 'home' && (!mobileEnabled || !address)) {
      return throwError(() => ({ status: 400, error: { error: 'Bitte geben Sie eine vollständige Besuchsadresse an.' } }));
    }
    try {
      const reservations = this.loadLocalReservations(company.slug);
      const occupied = reservations.filter((item) =>
        item.date === payload.date && item.time === payload.time && !item.isRequest);
      if (occupied.some((item) => item.isBlock) || occupied.length >= (company.slotCapacity || 3)) {
        return throwError(() => ({ status: 409 }));
      }
      const locationNotes = mobileEnabled
        ? bookingLocationNoteParts(payload.bookingLocation || 'salon', address) : [];
      const requestMode = mobileEnabled || company.bookingMode === 'request';
      reservations.push({
        id: crypto.randomUUID(),
        date: payload.date,
        time: payload.time,
        guestName: payload.guestName,
        guestEmail: payload.guestEmail,
        phone: payload.phone,
        people: payload.people,
        service: payload.service,
        stylist: payload.stylist,
        employeeId: payload.employeeId,
        note: payload.note || undefined,
        ...extractBookingLocation(locationNotes.join(' | ')),
        isRequest: requestMode,
        requestStatus: requestMode ? 'pending' : undefined,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(this.storageKey(company.slug), JSON.stringify(reservations));
      return of({ success: true, requestMode }).pipe(delay(250));
    } catch {
      return throwError(() => ({ error: { error: 'Die Testanfrage konnte auf diesem Gerät nicht gespeichert werden.' } }));
    }
  }

  private storageKey(slug: string): string {
    return `termine-direkt.company-reservations.${slug}`;
  }

  private loadLocalReservations(slug: string): CompanyReservation[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.storageKey(slug)) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
