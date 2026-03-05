import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, delay, of } from 'rxjs';

import { environment } from '../../environments/environment';

export type AdminStatsPeriod = 'this-month' | 'last-30-days' | 'month' | 'all';

export interface AdminStatsRow {
  slug: string;
  name: string;
  serviceType: 'restaurant' | 'friseur';
  bookings: number;
}

export interface AdminStatsResponse {
  period: AdminStatsPeriod;
  from: string | null;
  to: string | null;
  companiesTotal: number;
  bookingsTotal: number;
  rows: AdminStatsRow[];
}

interface LocalCompany {
  slug: string;
  name: string;
  serviceType?: 'restaurant' | 'friseur';
}

interface LocalReservation {
  date?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminStatsService {
  private readonly baseUrl = '/api/admin-stats';
  private readonly companiesKey = 'termine-direkt.companies';
  private readonly reservationsPrefix = 'termine-direkt.company-reservations.';

  constructor(private readonly http: HttpClient) {}

  getStats(period: AdminStatsPeriod, month?: string): Observable<AdminStatsResponse> {
    if (this.isLocalMock()) {
      return of(this.getLocalStats(period, month)).pipe(delay(120));
    }

    const params = new URLSearchParams({ period });
    if (period === 'month' && month) {
      params.set('month', month);
    }
    return this.http.get<AdminStatsResponse>(`${this.baseUrl}?${params.toString()}`);
  }

  private isLocalMock(): boolean {
    return (
      environment.mockApi &&
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost'
    );
  }

  private getLocalStats(period: AdminStatsPeriod, month?: string): AdminStatsResponse {
    const companies = this.loadCompanies();
    const range = this.getRange(period, month);

    const inRange = (dateValue?: string): boolean => {
      const parsed = this.parseDate(dateValue);
      if (!parsed) {
        return false;
      }
      const target = this.startOfDay(parsed);
      if (range.from && target < range.from) {
        return false;
      }
      if (range.to && target > range.to) {
        return false;
      }
      return true;
    };

    const rows: AdminStatsRow[] = companies.map((company) => {
      const raw = window.localStorage.getItem(`${this.reservationsPrefix}${company.slug}`);
      let reservations: LocalReservation[] = [];
      if (raw) {
        try {
          reservations = JSON.parse(raw) as LocalReservation[];
        } catch {
          reservations = [];
        }
      }
      const bookings = reservations.filter((item) => inRange(item.date)).length;
      return {
        slug: company.slug,
        name: company.name,
        serviceType: company.serviceType || 'restaurant',
        bookings
      };
    });

    rows.sort((a, b) => b.bookings - a.bookings || a.name.localeCompare(b.name, 'de'));

    return {
      period,
      from: this.formatDate(range.from),
      to: this.formatDate(range.to),
      companiesTotal: companies.length,
      bookingsTotal: rows.reduce((sum, row) => sum + row.bookings, 0),
      rows
    };
  }

  private loadCompanies(): LocalCompany[] {
    if (typeof window === 'undefined') {
      return [];
    }
    const raw = window.localStorage.getItem(this.companiesKey);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw) as LocalCompany[];
    } catch {
      return [];
    }
  }

  private getRange(period: AdminStatsPeriod, month?: string): { from: Date | null; to: Date | null } {
    const now = new Date();
    if (period === 'all') {
      return { from: null, to: null };
    }
    if (period === 'last-30-days') {
      const to = this.startOfDay(now);
      const from = new Date(to);
      from.setDate(from.getDate() - 29);
      return { from, to };
    }
    if (period === 'month' && month) {
      const m = /^(\d{4})-(\d{2})$/.exec(month);
      if (m) {
        const year = Number(m[1]);
        const monthIndex = Number(m[2]) - 1;
        return {
          from: new Date(year, monthIndex, 1),
          to: new Date(year, monthIndex + 1, 0)
        };
      }
    }
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0)
    };
  }

  private parseDate(value?: string): Date | null {
    if (!value) {
      return null;
    }
    const text = value.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    }
    const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
    if (dmy) {
      return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    }
    const named = /^(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s+(\d{4})$/.exec(text);
    if (!named) {
      return null;
    }
    const monthMap: Record<string, number> = {
      januar: 0,
      februar: 1,
      maerz: 2,
      märz: 2,
      april: 3,
      mai: 4,
      juni: 5,
      juli: 6,
      august: 7,
      september: 8,
      oktober: 9,
      november: 10,
      dezember: 11
    };
    const month = monthMap[named[2].toLowerCase()];
    if (month === undefined) {
      return null;
    }
    return new Date(Number(named[3]), month, Number(named[1]));
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private formatDate(date: Date | null): string | null {
    if (!date) {
      return null;
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

