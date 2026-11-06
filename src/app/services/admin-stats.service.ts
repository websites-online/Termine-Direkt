import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, delay, map, of } from 'rxjs';

import { environment } from '../../environments/environment';
import { CompanyApiService } from './company-api.service';
import { CompanyReservation } from './company-reservations.service';
import {
  AdminStatsCompany, AdminStatsPeriod, AdminStatsResponse, AdminStatsActivity,
  AdminStatsReservation, AdminStatsRequest, adminStatsRange, buildAdminStats, collectAdminStatsActivities,
} from '../shared/admin-statistics';
export type { AdminStatsPeriod, AdminStatsResponse, AdminStatsRow } from '../shared/admin-statistics';

@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  private readonly baseUrl = '/api/admin-stats';
  private readonly reservationsPrefix = 'termine-direkt.company-reservations.';

  constructor(private readonly http: HttpClient, private readonly companies: CompanyApiService) {}

  get isLocalPreview(): boolean {
    return environment.mockApi && typeof window !== 'undefined' && window.location.hostname === 'localhost';
  }

  getStats(period: AdminStatsPeriod, month?: string): Observable<AdminStatsResponse> {
    if (this.isLocalPreview) {
      return this.companies.listCompanies().pipe(map(companies => this.getLocalStats(companies, period, month)));
    }
    const params = new URLSearchParams({ period });
    if (period === 'month' && month) params.set('month', month);
    return this.http.get<AdminStatsResponse>(`${this.baseUrl}?${params.toString()}`);
  }

  /** Explicit, read-only examples. Never written to storage or mixed with real figures. */
  getDemoStats(period: AdminStatsPeriod, month?: string): Observable<AdminStatsResponse> {
    const companies: AdminStatsCompany[] = [
      { slug: 'atelier7', name: 'Atelier7', serviceType: 'friseur' },
      { slug: 'haarzeit-demo', name: 'Studio Haarzeit', serviceType: 'friseur' },
      { slug: 'osteria-demo', name: 'Osteria Bella Sera', serviceType: 'restaurant' },
    ];
    const range = adminStatsRange(period, month);
    const months = buildAdminStats(companies, [], period, month).monthlyTrend;
    const activities: AdminStatsActivity[] = [];
    months.forEach((point, index) => {
      const [year, number] = point.month.split('-').map(Number);
      const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
      companies.forEach((company, companyIndex) => {
        for (let day = 1; day <= days; day++) {
          const date = `${point.month}-${String(day).padStart(2, '0')}`;
          if (date > range.today) continue;
          const count = 1 + Math.floor(index / 2) + companyIndex + (day % 3 === 0 ? 1 : 0)
            + (index === 5 ? (companyIndex === 1 ? -1 : 1) : 0);
          for (let item = 0; item < count; item++) activities.push({ slug: company.slug, day: date,
            kind: companyIndex === 0 && item % 3 !== 0 ? 'request' : 'booking' });
        }
      });
    });
    return of({ ...buildAdminStats(companies, activities, period, month), requestsTableAvailable: true }).pipe(delay(120));
  }

  private getLocalStats(companies: AdminStatsCompany[], period: AdminStatsPeriod, month?: string): AdminStatsResponse {
    const reservations: AdminStatsReservation[] = [], requests: AdminStatsRequest[] = [];
    for (const company of companies) {
      let items: CompanyReservation[] = [];
      try {
        const value = JSON.parse(localStorage.getItem(`${this.reservationsPrefix}${company.slug}`) || '[]');
        if (Array.isArray(value)) items = value;
      } catch { /* A malformed local entry must not hide the other businesses. */ }
      for (const item of items) {
        if (!item || item.isBlock || item.isInternal || item.requestStatus === 'rejected') continue;
        const createdAt = item.createdAt || this.legacyDate(item.date);
        if (item.isRequest) requests.push({ id: item.id, restaurant_slug: company.slug, status: item.requestStatus || 'pending', created_at: createdAt });
        else reservations.push({ restaurant_slug: company.slug, guest_email: item.guestEmail, note: item.note, created_at: createdAt });
      }
    }
    return { ...buildAdminStats(companies, collectAdminStatsActivities(reservations, requests), period, month), requestsTableAvailable: true };
  }

  private legacyDate(value?: string): string | undefined {
    if (!value) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const numeric = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
    if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
    const named = /^(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s+(\d{4})$/.exec(value);
    const months = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
    if (!named) return undefined;
    const index = months.indexOf(named[2].toLocaleLowerCase('de').replace('maerz', 'märz'));
    return index < 0 ? undefined : `${named[3]}-${String(index + 1).padStart(2, '0')}-${named[1].padStart(2, '0')}`;
  }
}
