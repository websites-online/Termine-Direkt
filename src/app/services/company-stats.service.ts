import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { Company } from './company-api.service';
import { CompanyAuthService } from './company-auth.service';

export type CompanyStatsPeriod = 30 | 90 | 365;

export interface CompanyStatsCount {
  label: string;
  shortLabel?: string;
  detail?: string;
  count: number;
}

export interface CompanyStatsTrendPoint {
  label: string;
  fullLabel: string;
  count: number;
}

export interface CompanyStatsCustomer {
  name: string;
  count: number;
  lastDate: string;
}

export interface CompanyStatsResponse {
  period: CompanyStatsPeriod;
  from: string;
  to: string;
  companyName: string;
  eventKind: 'booking' | 'request';
  eventLabel: 'Buchungen' | 'Anfragen';
  total: number;
  previousTotal: number;
  changePercent: number | null;
  uniqueCustomers: number;
  returningCustomers: number;
  returningRate: number;
  averageLeadDays: number | null;
  bestWeekday: CompanyStatsCount;
  bestTime: CompanyStatsCount;
  strongestPhase: CompanyStatsCount;
  trend: CompanyStatsTrendPoint[];
  weekdays: CompanyStatsCount[];
  timeRanges: CompanyStatsCount[];
  monthPhases: CompanyStatsCount[];
  topCustomers: CompanyStatsCustomer[];
}

@Injectable({ providedIn: 'root' })
export class CompanyStatsService {
  private readonly baseUrl = this.resolveBaseUrl();

  constructor(
    private readonly http: HttpClient,
    private readonly authService: CompanyAuthService,
  ) {}

  getStats(period: CompanyStatsPeriod): Observable<CompanyStatsResponse> {
    if (this.isLocalMock()) {
      const company = this.getLocalCompany();
      if (company?.planTier !== 'pro') {
        return throwError(() => ({
          status: 403,
          error: { upgradeRequired: true },
        }));
      }
      return of(this.createDemoStats(period, company)).pipe(delay(280));
    }

    return this.http.get<CompanyStatsResponse>(`${this.baseUrl}?period=${period}`, {
      headers: this.authHeaders(),
    });
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
      return '/api/company/stats';
    }
    return baseUrl.length > 0 ? `${baseUrl}/api/company/stats` : '/api/company/stats';
  }

  private isLocalMock(): boolean {
    return (
      environment.mockApi &&
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost'
    );
  }

  private getLocalCompany(): Company | null {
    const slug = this.authService.getSession()?.slug;
    if (!slug || typeof window === 'undefined') {
      return null;
    }
    try {
      const raw = window.localStorage.getItem('termine-direkt.companies');
      const companies = raw ? (JSON.parse(raw) as Company[]) : [];
      return companies.find((company) => company.slug === slug) || null;
    } catch {
      return null;
    }
  }

  private createDemoStats(period: CompanyStatsPeriod, company: Company): CompanyStatsResponse {
    const config = {
      30: { total: 38, previous: 32, trend: [2, 3, 2, 5, 4, 3, 6, 5, 4, 4] },
      90: { total: 104, previous: 88, trend: [6, 7, 8, 7, 10, 9, 8, 11, 9, 10, 11, 8] },
      365: {
        total: 412,
        previous: 377,
        trend: [25, 27, 29, 31, 34, 33, 36, 39, 37, 40, 42, 39],
      },
    }[period];
    const to = this.startOfDay(new Date());
    const from = this.addDays(to, -(period - 1));
    const eventKind = company.bookingMode === 'request' ? 'request' : 'booking';
    const weekdayCounts = this.distribute(config.total, [0.02, 0.12, 0.12, 0.13, 0.15, 0.26, 0.2]);
    const timeCounts = this.distribute(config.total, [0.08, 0.18, 0.24, 0.37, 0.13]);
    const phaseCounts = this.distribute(config.total, [0.24, 0.29, 0.47]);
    const weekdayLabels = [
      'Sonntag',
      'Montag',
      'Dienstag',
      'Mittwoch',
      'Donnerstag',
      'Freitag',
      'Samstag',
    ];
    const weekdayShortLabels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const weekdays = weekdayLabels.map((label, index) => ({
      label,
      shortLabel: weekdayShortLabels[index],
      count: weekdayCounts[index],
    }));
    const timeRanges = ['Vor 10 Uhr', '10–13 Uhr', '13–16 Uhr', '16–19 Uhr', 'Ab 19 Uhr'].map(
      (label, index) => ({ label, count: timeCounts[index] }),
    );
    const monthPhases = [
      { label: 'Monatsanfang', detail: '1.–10.', count: phaseCounts[0] },
      { label: 'Monatsmitte', detail: '11.–20.', count: phaseCounts[1] },
      { label: 'Monatsende', detail: 'ab 21.', count: phaseCounts[2] },
    ];
    const bucketDays = Math.ceil(period / config.trend.length);
    const trend = config.trend.map((count, index) => {
      const bucketFrom = this.addDays(from, index * bucketDays);
      const bucketTo =
        index === config.trend.length - 1 ? to : this.addDays(bucketFrom, bucketDays - 1);
      return {
        label: new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(
          bucketFrom,
        ),
        fullLabel: `${this.formatShortDate(bucketFrom)} – ${this.formatShortDate(bucketTo)}`,
        count,
      };
    });

    return {
      period,
      from: this.formatDate(from),
      to: this.formatDate(to),
      companyName: company.name,
      eventKind,
      eventLabel: eventKind === 'request' ? 'Anfragen' : 'Buchungen',
      total: config.total,
      previousTotal: config.previous,
      changePercent: Math.round(((config.total - config.previous) / config.previous) * 100),
      uniqueCustomers: period === 30 ? 29 : period === 90 ? 73 : 246,
      returningCustomers: period === 30 ? 7 : period === 90 ? 19 : 68,
      returningRate: period === 30 ? 24 : period === 90 ? 26 : 28,
      averageLeadDays: period === 30 ? 5.4 : period === 90 ? 5.8 : 6.1,
      bestWeekday: weekdays[5],
      bestTime: timeRanges[3],
      strongestPhase: monthPhases[2],
      trend,
      weekdays,
      timeRanges,
      monthPhases,
      topCustomers: [
        { name: 'Lukas M.', count: 5, lastDate: this.formatDate(this.addDays(to, -2)) },
        { name: 'Emre K.', count: 4, lastDate: this.formatDate(this.addDays(to, -4)) },
        { name: 'Jonas B.', count: 3, lastDate: this.formatDate(this.addDays(to, -6)) },
        { name: 'David S.', count: 3, lastDate: this.formatDate(this.addDays(to, -8)) },
        { name: 'Tobias R.', count: 2, lastDate: this.formatDate(this.addDays(to, -9)) },
      ],
    };
  }

  private distribute(total: number, weights: number[]): number[] {
    const values = weights.map((weight) => Math.floor(total * weight));
    let remaining = total - values.reduce((sum, value) => sum + value, 0);
    let index = 0;
    while (remaining > 0) {
      values[index % values.length] += 1;
      remaining -= 1;
      index += 1;
    }
    return values;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, amount: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  private formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(date);
  }
}
