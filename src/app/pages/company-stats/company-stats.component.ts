import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { CountUpDirective } from '../../shared/count-up.directive';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { CompanyAuthService, CompanySession } from '../../services/company-auth.service';
import {
  CompanyStatsPeriod,
  CompanyStatsResponse,
  CompanyStatsService,
} from '../../services/company-stats.service';

@Component({
  selector: 'app-company-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CountUpDirective],
  templateUrl: './company-stats.component.html',
})
export class CompanyStatsComponent implements OnInit {
  readonly periodOptions: Array<{ value: CompanyStatsPeriod; label: string }> = [
    { value: 30, label: 'Letzte 30 Tage' },
    { value: 90, label: 'Letzte 90 Tage' },
    { value: 365, label: 'Letzte 12 Monate' },
  ];

  /** Monatspreis des Pro-Tarifs – Grundlage für die Rendite-Rechnung. */
  readonly planPrice = 24.99;
  readonly ticketPresets = [20, 35, 50, 80];
  avgTicket = 35;
  activePoint = -1;
  chartMode: 'revenue' | 'count' = 'revenue';

  session: CompanySession | null = null;
  period: CompanyStatsPeriod = 30;
  stats: CompanyStatsResponse | null = null;
  isLoading = false;
  upgradeRequired = false;
  errorMessage = '';

  constructor(
    private readonly authService: CompanyAuthService,
    private readonly statsService: CompanyStatsService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.session = this.authService.getSession();
    this.avgTicket = this.readTicket();
    this.loadStats();
  }

  loadStats(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.upgradeRequired = false;
    this.statsService.getStats(this.period).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        this.stats = null;
        if (error?.status === 403 || error?.error?.upgradeRequired) {
          this.upgradeRequired = true;
          return;
        }
        this.errorMessage = 'Die Statistik konnte gerade nicht geladen werden.';
      },
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/unternehmen/login']);
  }

  copyBookingLink(): void {
    if (!this.session?.slug || typeof navigator === 'undefined') {
      return;
    }
    navigator.clipboard?.writeText(`${window.location.origin}/${this.session.slug}`);
  }

  get companyName(): string {
    return this.session?.name || 'Unternehmen';
  }

  get companyInitials(): string {
    return this.companyName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  get isSalon(): boolean {
    return this.session?.serviceType === 'friseur';
  }

  get maxTrendCount(): number {
    return Math.max(...(this.stats?.trend.map((point) => point.count) || [1]), 1);
  }

  get maxWeekdayCount(): number {
    return Math.max(...(this.stats?.weekdays.map((item) => item.count) || [1]), 1);
  }

  get maxTimeCount(): number {
    return Math.max(...(this.stats?.timeRanges.map((item) => item.count) || [1]), 1);
  }

  get comparisonLabel(): string {
    const change = this.stats?.changePercent;
    if (change === null || change === undefined) {
      return 'Neu im Vergleichszeitraum';
    }
    if (change === 0) {
      return 'Genau wie zuvor';
    }
    return `${change > 0 ? '+' : ''}${change} % zum Zeitraum davor`;
  }

  get insightText(): string {
    if (!this.stats || this.stats.total === 0) {
      return 'Sobald die ersten Kundentermine eingehen, erkennen Sie hier Ihre stärksten Zeiten.';
    }
    return `${this.stats.bestWeekday.label} ist Ihr stärkster Tag. Besonders gefragt ist die Zeit ${this.stats.bestTime.label.toLowerCase()}, am meisten passiert am ${this.stats.strongestPhase.label.toLowerCase()}.`;
  }

  barHeight(value: number): string {
    return `${value === 0 ? 4 : Math.max(12, Math.round((value / this.maxTrendCount) * 100))}%`;
  }

  weekdayWidth(value: number): string {
    return `${value === 0 ? 0 : Math.max(8, Math.round((value / this.maxWeekdayCount) * 100))}%`;
  }

  timeWidth(value: number): string {
    return `${value === 0 ? 0 : Math.max(8, Math.round((value / this.maxTimeCount) * 100))}%`;
  }

  formatDate(value: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return value;
    }
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(
      new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
  }

  formatRate(value: number | null): string {
    return value === null ? '–' : `${value} %`;
  }

  /* ---------- Umsatz-Schätzung ---------- */
  private get ticketKey(): string {
    return `nextime.avg-ticket.${this.session?.slug || 'default'}`;
  }

  private readTicket(): number {
    const fallback = this.isSalon ? 35 : 60;
    try {
      const stored = Number(localStorage.getItem(this.ticketKey));
      return Number.isFinite(stored) && stored > 0 ? stored : fallback;
    } catch {
      return fallback;
    }
  }

  setTicket(value: number | string): void {
    const next = Math.min(2000, Math.max(1, Math.round(Number(value) || 0)));
    this.avgTicket = next;
    try {
      localStorage.setItem(this.ticketKey, String(next));
    } catch {
      /* Speichern ist optional */
    }
  }

  adjustTicket(delta: number): void {
    this.setTicket(this.avgTicket + delta);
  }

  get ticketLabel(): string {
    return this.isSalon ? 'Ø Umsatz pro Termin' : 'Ø Umsatz pro Reservierung';
  }

  get ticketHint(): string {
    return this.isSalon
      ? 'Schnitt, Färben, Bart … – schätzen Sie, was ein Kunde im Schnitt ausgibt.'
      : 'Was geben Gäste pro Reservierung im Schnitt aus? Inklusive Getränke und mehrerer Personen.';
  }

  /** Anzahl Termine, die in die Schätzung einfließen (bei Anfrage-Modus nur angenommene). */
  get revenueBookings(): number {
    const stats = this.stats;
    if (!stats) {
      return 0;
    }
    if (stats.eventKind === 'request' && stats.conversion.trackingAvailable) {
      return Math.min(stats.total, stats.conversion.completions);
    }
    return stats.total;
  }

  get estimatedRevenue(): number {
    return this.revenueBookings * this.avgTicket;
  }

  get revenueChangeLabel(): string {
    const stats = this.stats;
    if (!stats || stats.previousTotal === 0) {
      return this.estimatedRevenue > 0 ? 'Neu im Vergleich zum Zeitraum davor' : 'Noch keine Buchungen';
    }
    const previous = stats.previousTotal * this.avgTicket;
    const change = Math.round(((this.estimatedRevenue - previous) / previous) * 100);
    return `${change > 0 ? '+' : ''}${change} % zum Zeitraum davor`;
  }

  get revenueChangeNegative(): boolean {
    const stats = this.stats;
    return !!stats && stats.previousTotal > stats.total;
  }

  get periodMonths(): number {
    return Math.max(1, this.period / 30);
  }

  get roiFactor(): number {
    return Math.round((this.estimatedRevenue / (this.planPrice * this.periodMonths)) * 10) / 10;
  }

  get revenuePerDay(): number {
    return Math.round(this.estimatedRevenue / this.period);
  }

  euro(value: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  /* ---------- Umsatz-Kurve ---------- */
  readonly chartW = 640;
  readonly chartH = 220;
  private readonly padX = 8;
  private readonly padTop = 18;
  private readonly padBottom = 8;

  get revenueSeries(): number[] {
    const stats = this.stats;
    if (stats && this.chartMode === 'count') {
      return stats.trend.map((point) => point.count);
    }
    if (!stats || stats.total === 0) {
      return (stats?.trend || []).map(() => 0);
    }
    const scale = this.revenueBookings / stats.total;
    return stats.trend.map((point) => point.count * scale * this.avgTicket);
  }

  private get chartMax(): number {
    return Math.max(...this.revenueSeries, 1);
  }

  get chartPoints(): Array<{ x: number; y: number; value: number; label: string }> {
    const series = this.revenueSeries;
    const trend = this.stats?.trend || [];
    const step = series.length > 1 ? (this.chartW - this.padX * 2) / (series.length - 1) : 0;
    const usable = this.chartH - this.padTop - this.padBottom;
    return series.map((value, index) => ({
      x: this.padX + step * index,
      y: this.padTop + usable - (value / this.chartMax) * usable,
      value,
      label: trend[index]?.fullLabel || '',
    }));
  }

  get chartLine(): string {
    const points = this.chartPoints;
    if (points.length === 0) {
      return '';
    }
    if (points.length === 1) {
      return `M${points[0].x} ${points[0].y}`;
    }
    let path = `M${points[0].x} ${points[0].y}`;
    for (let index = 0; index < points.length - 1; index++) {
      const p0 = points[index - 1] || points[index];
      const p1 = points[index];
      const p2 = points[index + 1];
      const p3 = points[index + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  }

  get chartArea(): string {
    const points = this.chartPoints;
    if (points.length < 2) {
      return '';
    }
    const base = this.chartH - this.padBottom;
    return `${this.chartLine} L${points[points.length - 1].x} ${base} L${points[0].x} ${base} Z`;
  }

  chartValueLabel(value: number): string {
    return this.chartMode === 'count' ? `${Math.round(value)} ${this.stats?.eventLabel || ''}` : this.euro(value);
  }

  get chartMaxLabel(): string {
    return this.chartValueLabel(this.chartMax);
  }

  scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  get periodShort(): string {
    return this.period === 30 ? '30 Tage' : this.period === 90 ? '90 Tage' : '12 Monate';
  }

  get chartGrid(): Array<{ y: number; label: string }> {
    const usable = this.chartH - this.padTop - this.padBottom;
    return [0, 0.5, 1].map((ratio) => ({
      y: this.padTop + usable - ratio * usable,
      label: this.chartValueLabel(this.chartMax * ratio),
    }));
  }

  get chartLabels(): string[] {
    const trend = this.stats?.trend || [];
    const every = Math.max(1, Math.ceil(trend.length / 6));
    return trend.map((point, index) => (index % every === 0 ? point.label : ''));
  }

  onChartMove(event: PointerEvent | MouseEvent, element: Element): void {
    const rect = element.getBoundingClientRect();
    const points = this.chartPoints;
    if (!rect.width || points.length === 0) {
      return;
    }
    const x = ((event.clientX - rect.left) / rect.width) * this.chartW;
    let best = 0;
    for (let index = 1; index < points.length; index++) {
      if (Math.abs(points[index].x - x) < Math.abs(points[best].x - x)) {
        best = index;
      }
    }
    this.activePoint = best;
  }

  clearChart(): void {
    this.activePoint = -1;
  }
}
