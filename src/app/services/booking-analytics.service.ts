import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BookingAnalyticsService {
  private readonly endpoint = '/api/booking-events';
  private readonly sentEvents = new Set<string>();

  constructor(private readonly http: HttpClient) {}

  trackPageView(companySlug: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        this.track(companySlug, 'page_view');
      }
    }, 1200);
  }

  trackBookingStarted(companySlug: string): void {
    this.track(companySlug, 'booking_started');
  }

  private track(companySlug: string, eventType: 'page_view' | 'booking_started'): void {
    if (
      typeof window === 'undefined' ||
      typeof sessionStorage === 'undefined' ||
      (navigator as Navigator & { webdriver?: boolean }).webdriver
    ) {
      return;
    }
    const slug = companySlug.trim().toLowerCase();
    if (!slug) {
      return;
    }
    if (this.isInternalVisit(slug)) {
      return;
    }
    const sessionId = this.getSessionId(slug);
    const eventKey = `${slug}:${eventType}:${sessionId}`;
    if (this.sentEvents.has(eventKey)) {
      return;
    }
    this.sentEvents.add(eventKey);
    this.http
      .post(this.endpoint, { companySlug: slug, eventType, sessionId }, { observe: 'response' })
      .subscribe({
        error: () => this.sentEvents.delete(eventKey),
      });
  }

  private getSessionId(companySlug: string): string {
    const key = `nextime.booking-session.${companySlug}`;
    const existing = sessionStorage.getItem(key);
    if (existing) {
      return existing;
    }
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, generated);
    return generated;
  }

  private isInternalVisit(companySlug: string): boolean {
    if (localStorage.getItem('admin_token')) {
      return true;
    }
    try {
      const rawSession = localStorage.getItem('company_session');
      const session = rawSession ? JSON.parse(rawSession) : null;
      return String(session?.slug || '').toLowerCase() === companySlug;
    } catch {
      return false;
    }
  }
}
