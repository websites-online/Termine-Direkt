import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { AdminAuthService } from './admin-auth.service';

export type LeadCategory = 'restaurant' | 'friseur';
export type LeadStatus =
  | 'new'
  | 'reviewed'
  | 'contacted'
  | 'replied'
  | 'no_interest'
  | 'customer'
  | 'excluded';

export interface SalesLead {
  id: string;
  sourceKey: string;
  name: string;
  category: LeadCategory;
  city: string;
  postcode?: string;
  address?: string;
  website?: string;
  phone?: string;
  email?: string;
  contactUrl?: string;
  sourceUrl?: string;
  scanRegion: string;
  hasBookingSystem: boolean;
  bookingSystem?: string;
  bookingEvidence?: string;
  confidence: number;
  status: LeadStatus;
  notes?: string;
  discoveredAt: string;
  lastScannedAt: string;
  contactedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminLeadsService {
  private readonly baseUrl = this.resolveBaseUrl();
  private readonly storageKey = 'nextime.demo-sales-leads';

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AdminAuthService,
  ) {}

  listLeads(): Observable<SalesLead[]> {
    if (this.isLocalMock()) {
      return of(this.loadLocalLeads()).pipe(delay(260));
    }
    return this.http.get<SalesLead[]>(this.baseUrl, { headers: this.authHeaders() });
  }

  updateLead(id: string, status: LeadStatus, notes = ''): Observable<SalesLead> {
    if (this.isLocalMock()) {
      const leads = this.loadLocalLeads();
      const index = leads.findIndex((lead) => lead.id === id);
      if (index === -1) {
        return throwError(() => new Error('Lead wurde nicht gefunden.'));
      }
      leads[index] = {
        ...leads[index],
        status,
        notes: notes || undefined,
        contactedAt: status === 'contacted' ? new Date().toISOString() : leads[index].contactedAt,
      };
      localStorage.setItem(this.storageKey, JSON.stringify(leads));
      return of(leads[index]).pipe(delay(120));
    }
    return this.http.patch<SalesLead>(
      `${this.baseUrl}?id=${encodeURIComponent(id)}`,
      { status, notes },
      { headers: this.authHeaders() },
    );
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.getAuthToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  private resolveBaseUrl(): string {
    const baseUrl = environment.API_BASE_URL || '';
    if (
      typeof window !== 'undefined' &&
      baseUrl.includes('localhost') &&
      window.location.hostname !== 'localhost'
    ) {
      return '/api/admin/leads';
    }
    return baseUrl.length > 0 ? `${baseUrl}/api/admin/leads` : '/api/admin/leads';
  }

  private isLocalMock(): boolean {
    return (
      environment.mockApi &&
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost'
    );
  }

  private loadLocalLeads(): SalesLead[] {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        return JSON.parse(stored) as SalesLead[];
      } catch {
        // Bei ungültigen lokalen Daten werden die Beispiele neu aufgebaut.
      }
    }
    const now = new Date();
    const discoveredAt = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - ((now.getDay() + 6) % 7),
      7,
      15,
    ).toISOString();
    const examples: SalesLead[] = [
      {
        id: 'demo-lead-1',
        sourceKey: 'demo:nuernberg:1',
        name: 'Barberwerk Nürnberg',
        category: 'friseur',
        city: 'Nürnberg',
        postcode: '90402',
        address: 'Königstraße 18, Nürnberg',
        website: 'https://example.com/barberwerk',
        phone: '0911 2345678',
        email: 'info@barberwerk-beispiel.de',
        contactUrl: 'https://example.com/barberwerk/kontakt',
        sourceUrl: 'https://www.openstreetmap.org/',
        scanRegion: 'Nürnberg',
        hasBookingSystem: false,
        bookingEvidence: 'Startseite, Kontakt und Impressum geprüft; kein Buchungslink erkannt.',
        confidence: 92,
        status: 'new',
        discoveredAt,
        lastScannedAt: discoveredAt,
      },
      {
        id: 'demo-lead-2',
        sourceKey: 'demo:nuernberg:2',
        name: 'Ristorante Piazza Verde',
        category: 'restaurant',
        city: 'Nürnberg',
        postcode: '90403',
        address: 'Obere Gasse 7, Nürnberg',
        website: 'https://example.com/piazza-verde',
        phone: '0911 8765432',
        email: 'kontakt@piazza-verde-beispiel.de',
        sourceUrl: 'https://www.openstreetmap.org/',
        scanRegion: 'Nürnberg',
        hasBookingSystem: false,
        bookingEvidence: 'Reservierungen werden auf der Website nur telefonisch angeboten.',
        confidence: 89,
        status: 'new',
        discoveredAt,
        lastScannedAt: discoveredAt,
      },
      {
        id: 'demo-lead-3',
        sourceKey: 'demo:fuerth:1',
        name: 'Haarkunst am Stadtpark',
        category: 'friseur',
        city: 'Fürth',
        postcode: '90762',
        address: 'Moststraße 11, Fürth',
        website: 'https://example.com/haarkunst',
        phone: '0911 1122334',
        contactUrl: 'https://example.com/haarkunst/kontakt',
        sourceUrl: 'https://www.openstreetmap.org/',
        scanRegion: 'Fürth',
        hasBookingSystem: false,
        bookingEvidence: 'Zwei Seiten geprüft; kein Online-Terminsystem erkannt.',
        confidence: 86,
        status: 'reviewed',
        discoveredAt,
        lastScannedAt: discoveredAt,
      },
      {
        id: 'demo-lead-4',
        sourceKey: 'demo:erlangen:1',
        name: 'Gasthaus Erlanger Hof',
        category: 'restaurant',
        city: 'Erlangen',
        postcode: '91054',
        address: 'Hauptstraße 42, Erlangen',
        website: 'https://example.com/erlanger-hof',
        phone: '09131 445566',
        email: 'reservierung@erlanger-hof-beispiel.de',
        sourceUrl: 'https://www.openstreetmap.org/',
        scanRegion: 'Erlangen',
        hasBookingSystem: false,
        bookingEvidence: 'Nur E-Mail und Telefonnummer für Reservierungen gefunden.',
        confidence: 94,
        status: 'contacted',
        discoveredAt,
        lastScannedAt: discoveredAt,
        contactedAt: discoveredAt,
      },
      {
        id: 'demo-lead-5',
        sourceKey: 'demo:stein:1',
        name: 'Schnittpunkt Stein',
        category: 'friseur',
        city: 'Stein',
        website: 'https://example.com/schnittpunkt',
        phone: '0911 778899',
        email: 'hallo@schnittpunkt-beispiel.de',
        sourceUrl: 'https://www.openstreetmap.org/',
        scanRegion: 'Stein',
        hasBookingSystem: false,
        bookingEvidence: 'Kein externer Buchungsanbieter und kein Buchungsformular erkannt.',
        confidence: 83,
        status: 'new',
        discoveredAt,
        lastScannedAt: discoveredAt,
      },
    ];
    localStorage.setItem(this.storageKey, JSON.stringify(examples));
    return examples;
  }
}
