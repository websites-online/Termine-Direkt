import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';

import { environment } from '../../environments/environment';

export type ServiceType = 'restaurant' | 'friseur';

export interface Company {
  id?: string;
  name: string;
  slug: string;
  address: string;
  hours: string;
  breakHours?: string;
  email: string;
  serviceType?: ServiceType;
  loginPin?: string;
  createdAt?: string;
}

export interface CompanyPayload {
  name: string;
  address: string;
  hours: string;
  breakHours?: string;
  email: string;
  serviceType?: ServiceType;
  loginPin?: string;
}

@Injectable({
  providedIn: 'root'
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
      const slug = this.createUniqueSlug(payload.name, companies.map((item) => item.slug));
      const created: Company = {
        id: `${Date.now()}`,
        slug,
        createdAt: new Date().toISOString(),
        ...payload
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
        companies.filter((item) => item.slug !== slug).map((item) => item.slug)
      );
      const updated: Company = {
        ...companies[index],
        ...payload,
        slug: nextSlug
      };
      if (!payload.loginPin) {
        updated.loginPin = companies[index].loginPin;
      }
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
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}?slug=${encodeURIComponent(slug)}`);
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
      if (!raw) {
        return [];
      }
      return JSON.parse(raw) as Company[];
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
}
