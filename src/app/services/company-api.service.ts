import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';

import { environment } from '../../environments/environment';
import { SALON_SERVICES, SalonServiceOption } from '../shared/salon-services';

export type ServiceType = 'restaurant' | 'friseur';
export type BookingMode = 'confirm' | 'request';
export type TimeSelectionMode = 'slots' | 'free';
export type PlanTier = 'starter' | 'pro';

export interface Company {
  id?: string;
  name: string;
  slug: string;
  address: string;
  hours: string;
  breakHours?: string;
  email: string;
  splitServiceEmails?: boolean;
  womenServicesEmail?: string;
  serviceType?: ServiceType;
  loginPin?: string;
  slotCapacity?: number;
  slotIntervalMinutes?: 30 | 45 | 60;
  bookingBufferMinutes?: number;
  timeSelectionMode?: TimeSelectionMode;
  bookingMode?: BookingMode;
  seatingOptionsEnabled?: boolean;
  stylistSelectionEnabled?: boolean;
  stylists?: string[];
  salonServices?: SalonServiceOption[];
  showServicePrices?: boolean;
  logoUrl?: string;
  brandColor?: string;
  planTier?: PlanTier;
  createdAt?: string;
}

export interface CompanyPayload {
  name: string;
  address: string;
  hours: string;
  breakHours?: string;
  email: string;
  splitServiceEmails?: boolean;
  womenServicesEmail?: string;
  serviceType?: ServiceType;
  loginPin?: string;
  slotCapacity?: number;
  slotIntervalMinutes?: 30 | 45 | 60;
  bookingBufferMinutes?: number;
  timeSelectionMode?: TimeSelectionMode;
  bookingMode?: BookingMode;
  seatingOptionsEnabled?: boolean;
  stylistSelectionEnabled?: boolean;
  stylists?: string[];
  salonServices?: SalonServiceOption[];
  showServicePrices?: boolean;
  logoUrl?: string;
  brandColor?: string;
  planTier?: PlanTier;
}

@Injectable({
  providedIn: 'root',
})
export class CompanyApiService {
  private readonly baseUrl = '/api/companies';
  private readonly storageKey = 'termine-direkt.companies';

  constructor(private readonly http: HttpClient) {}

  listCompanies(): Observable<Company[]> {
    if (this.isLocalMock()) {
      return of(this.loadLocalCompanies()).pipe(delay(200));
    }
    return this.http.get<Company[]>(this.baseUrl);
  }

  getCompany(slug: string): Observable<Company | null> {
    if (this.isLocalMock()) {
      const company = this.loadLocalCompanies().find((item) => item.slug === slug) || null;
      return of(company).pipe(delay(200));
    }
    return this.http.get<Company>(`${this.baseUrl}?slug=${encodeURIComponent(slug)}`);
  }

  createCompany(payload: CompanyPayload): Observable<Company> {
    if (this.isLocalMock()) {
      const companies = this.loadLocalCompanies();
      const slug = this.createUniqueSlug(
        payload.name,
        companies.map((item) => item.slug),
      );
      const created: Company = {
        id: `${Date.now()}`,
        slug,
        createdAt: new Date().toISOString(),
        ...payload,
        slotIntervalMinutes: payload.slotIntervalMinutes || 45,
        bookingBufferMinutes: this.normalizeBookingBufferMinutes(payload.bookingBufferMinutes),
        timeSelectionMode: payload.timeSelectionMode || 'slots',
        bookingMode: payload.bookingMode || 'confirm',
        seatingOptionsEnabled: payload.seatingOptionsEnabled === true,
        stylistSelectionEnabled:
          payload.serviceType === 'friseur' && payload.stylistSelectionEnabled === true,
        stylists: payload.serviceType === 'friseur' ? this.normalizeStylists(payload.stylists) : [],
        salonServices:
          payload.serviceType === 'friseur'
            ? this.normalizeSalonServices(payload.salonServices)
            : [],
        showServicePrices: payload.serviceType === 'friseur' && payload.showServicePrices === true,
        logoUrl: this.normalizeLogoUrl(payload.logoUrl),
        brandColor: this.normalizeBrandColor(payload.brandColor),
        planTier: payload.planTier === 'pro' ? 'pro' : 'starter',
        splitServiceEmails:
          payload.serviceType === 'friseur' && payload.splitServiceEmails === true,
        womenServicesEmail:
          payload.serviceType === 'friseur' && payload.splitServiceEmails === true
            ? this.normalizeOptionalEmail(payload.womenServicesEmail)
            : undefined,
      };
      companies.unshift(created);
      this.saveLocalCompanies(companies);
      return of(created).pipe(delay(200));
    }
    return this.http.post<Company>(this.baseUrl, payload);
  }

  updateCompany(slug: string, payload: CompanyPayload): Observable<Company> {
    if (this.isLocalMock()) {
      const companies = this.loadLocalCompanies();
      const index = companies.findIndex((item) => item.slug === slug);
      if (index === -1) {
        return of({ ...payload, slug } as Company).pipe(delay(200));
      }
      const nextSlug = this.createUniqueSlug(
        payload.name,
        companies.filter((item) => item.slug !== slug).map((item) => item.slug),
      );
      const updated: Company = {
        ...companies[index],
        ...payload,
        slug: nextSlug,
      };
      if (!payload.loginPin) {
        updated.loginPin = companies[index].loginPin;
      }
      if (payload.slotCapacity === undefined || payload.slotCapacity === null) {
        updated.slotCapacity = companies[index].slotCapacity;
      }
      if (!payload.slotIntervalMinutes) {
        updated.slotIntervalMinutes = companies[index].slotIntervalMinutes ?? 45;
      }
      if (payload.bookingBufferMinutes === undefined || payload.bookingBufferMinutes === null) {
        updated.bookingBufferMinutes = this.normalizeBookingBufferMinutes(
          companies[index].bookingBufferMinutes,
        );
      } else {
        updated.bookingBufferMinutes = this.normalizeBookingBufferMinutes(
          payload.bookingBufferMinutes,
        );
      }
      if (!payload.timeSelectionMode) {
        updated.timeSelectionMode = companies[index].timeSelectionMode || 'slots';
      }
      if (!payload.bookingMode) {
        updated.bookingMode = companies[index].bookingMode || 'confirm';
      }
      if (typeof payload.seatingOptionsEnabled !== 'boolean') {
        updated.seatingOptionsEnabled = companies[index].seatingOptionsEnabled || false;
      }
      updated.stylistSelectionEnabled =
        updated.serviceType === 'friseur' && payload.stylistSelectionEnabled === true;
      updated.stylists =
        updated.serviceType === 'friseur' ? this.normalizeStylists(payload.stylists) : [];
      updated.salonServices =
        updated.serviceType === 'friseur' ? this.normalizeSalonServices(payload.salonServices) : [];
      updated.showServicePrices =
        updated.serviceType === 'friseur' && payload.showServicePrices === true;
      updated.logoUrl = this.normalizeLogoUrl(payload.logoUrl);
      updated.brandColor = this.normalizeBrandColor(payload.brandColor);
      updated.planTier = payload.planTier === 'pro' ? 'pro' : 'starter';
      updated.splitServiceEmails =
        updated.serviceType === 'friseur' && payload.splitServiceEmails === true;
      updated.womenServicesEmail =
        updated.splitServiceEmails === true
          ? this.normalizeOptionalEmail(payload.womenServicesEmail)
          : undefined;
      companies[index] = updated;
      this.saveLocalCompanies(companies);
      return of(updated).pipe(delay(200));
    }
    return this.http.patch<Company>(`${this.baseUrl}?slug=${encodeURIComponent(slug)}`, payload);
  }

  deleteCompany(slug: string): Observable<{ success: boolean }> {
    if (this.isLocalMock()) {
      const companies = this.loadLocalCompanies().filter((item) => item.slug !== slug);
      this.saveLocalCompanies(companies);
      return of({ success: true }).pipe(delay(200));
    }
    return this.http.delete<{ success: boolean }>(
      `${this.baseUrl}?slug=${encodeURIComponent(slug)}`,
    );
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
      const raw = window.localStorage.getItem(this.storageKey);
      const parsed = raw ? (JSON.parse(raw) as Company[]) : [];
      if (!parsed.some((company) => company.slug === 'new-city-barber-demo')) {
        parsed.push(this.createLocalProDemoCompany());
        this.saveLocalCompanies(parsed);
      }
      return parsed.map((company) => {
        const isDemo = company.slug === 'new-city-barber-demo';
        const configuredSalonServices = this.normalizeSalonServices(company.salonServices);
        return {
          ...company,
          slotIntervalMinutes:
            company.slotIntervalMinutes === 30 || company.slotIntervalMinutes === 60
              ? company.slotIntervalMinutes
              : 45,
          bookingBufferMinutes: this.normalizeBookingBufferMinutes(company.bookingBufferMinutes),
          timeSelectionMode: company.timeSelectionMode === 'free' ? 'free' : 'slots',
          stylistSelectionEnabled:
            company.serviceType === 'friseur' && company.stylistSelectionEnabled === true,
          stylists:
            company.serviceType === 'friseur' ? this.normalizeStylists(company.stylists) : [],
          salonServices:
            company.serviceType === 'friseur'
              ? configuredSalonServices.length > 0
                ? configuredSalonServices
                : isDemo
                  ? this.createLocalDemoSalonServices()
                  : []
              : [],
          showServicePrices:
            company.serviceType === 'friseur' &&
            (company.showServicePrices === true ||
              (isDemo && company.showServicePrices === undefined)),
          logoUrl: this.normalizeLogoUrl(company.logoUrl),
          brandColor: this.normalizeBrandColor(company.brandColor),
          planTier: company.planTier === 'pro' ? 'pro' : 'starter',
          splitServiceEmails:
            company.serviceType === 'friseur' && company.splitServiceEmails === true,
          womenServicesEmail:
            company.serviceType === 'friseur' && company.splitServiceEmails === true
              ? this.normalizeOptionalEmail(company.womenServicesEmail)
              : undefined,
        };
      });
    } catch {
      return [];
    }
  }

  private saveLocalCompanies(companies: Company[]): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(this.storageKey, JSON.stringify(companies));
  }

  private createLocalProDemoCompany(): Company {
    return {
      id: 'local-pro-demo',
      name: 'New City Barber (Demo)',
      slug: 'new-city-barber-demo',
      address: 'Musterstraße 24, 10115 Berlin',
      hours: 'Mo–Fr 09:00–19:00; Sa 09:00–16:00',
      email: 'demo@nextime.de',
      serviceType: 'friseur',
      loginPin: '123456',
      slotCapacity: 1,
      slotIntervalMinutes: 30,
      bookingBufferMinutes: 120,
      timeSelectionMode: 'slots',
      bookingMode: 'request',
      stylistSelectionEnabled: true,
      stylists: ['Marco', 'Sarah', 'Deniz'],
      salonServices: this.createLocalDemoSalonServices(),
      showServicePrices: true,
      brandColor: '#111827',
      planTier: 'pro',
      createdAt: new Date().toISOString(),
    };
  }

  private createUniqueSlug(name: string, taken: string[]): string {
    const base = this.createSlug(name || 'unternehmen');
    let candidate = base;
    let suffix = 2;
    while (taken.includes(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private createSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\\s-]/g, '')
      .replace(/\\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private normalizeBookingBufferMinutes(value: unknown): number {
    const minutes = Number(value);
    if (!Number.isFinite(minutes)) {
      return 120;
    }
    return Math.min(Math.max(Math.round(minutes), 0), 1440);
  }

  private normalizeStylists(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return Array.from(
      new Set(value.map((item) => String(item || '').trim()).filter((item) => item.length > 0)),
    );
  }

  private normalizeSalonServices(value: unknown): SalonServiceOption[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const selected = new Map<string, SalonServiceOption>();
    value.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }
      const record = item as Partial<SalonServiceOption>;
      const serviceValue = String(record.value || '').trim();
      const label = String(record.label || '')
        .trim()
        .slice(0, 120);
      if (!/^[a-z0-9_]{1,80}$/.test(serviceValue) || !label || selected.has(serviceValue)) {
        return;
      }
      const audience: SalonServiceOption['audience'] =
        record.audience === 'men' || record.audience === 'women' ? record.audience : 'general';
      const price = Number(record.price);
      selected.set(serviceValue, {
        value: serviceValue,
        label,
        audience,
        ...(record.price !== undefined &&
        record.price !== null &&
        Number.isFinite(price) &&
        price >= 0 &&
        price <= 10000
          ? { price: Math.round(price * 100) / 100 }
          : {}),
      });
    });
    return Array.from(selected.values()).slice(0, 100);
  }

  private createLocalDemoSalonServices(): SalonServiceOption[] {
    return [
      { ...SALON_SERVICES[0], price: 24 },
      { ...SALON_SERVICES[1], price: 27 },
      { ...SALON_SERVICES[4], price: 35 },
      { ...SALON_SERVICES[5], price: 15 },
    ];
  }

  private normalizeOptionalEmail(value: unknown): string | undefined {
    const email = String(value || '').trim();
    return email.length > 0 ? email : undefined;
  }

  private normalizeLogoUrl(value: unknown): string | undefined {
    const logoUrl = String(value || '').trim();
    return logoUrl.length > 0 ? logoUrl : undefined;
  }

  private normalizeBrandColor(value: unknown): string {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '#4f46e5';
  }
}
