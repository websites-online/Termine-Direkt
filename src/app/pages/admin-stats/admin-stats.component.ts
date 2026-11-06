import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { AdminAuthService } from '../../services/admin-auth.service';
import { AdminStatsPeriod, AdminStatsResponse, AdminStatsRow, AdminStatsService } from '../../services/admin-stats.service';
import { berlinDay, statsChangePercent } from '../../shared/admin-statistics';

interface SummaryMetric { label: string; value: number; previous: number | null; detail: string; }

@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-stats.component.html',
  styleUrls: ['./admin-stats.component.css', './admin-stats-detail.css'],
})
export class AdminStatsComponent implements OnInit, OnDestroy {
  readonly periodOptions: Array<{ value: AdminStatsPeriod; label: string }> = [
    { value: 'this-month', label: 'Diesen Monat' },
    { value: 'last-month', label: 'Letzten Monat' },
    { value: 'last-30-days', label: 'Letzte 30 Tage' },
    { value: 'month', label: 'Monat auswählen' },
    { value: 'all', label: 'Gesamt' },
  ];
  readonly currentMonth = berlinDay(new Date())!.slice(0, 7);
  period: AdminStatsPeriod = 'this-month';
  month = this.currentMonth;
  isLoading = false;
  error = '';
  stats: AdminStatsResponse | null = null;
  metrics: SummaryMetric[] = [];
  searchQuery = '';
  sortBy: 'total' | 'change' | 'name' = 'total';
  demoMode = false;
  private request?: Subscription;

  constructor(
    private readonly statsService: AdminStatsService,
    private readonly authService: AdminAuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  get isLocalPreview(): boolean { return this.statsService.isLocalPreview; }
  get trendMax(): number { return Math.max(1, ...(this.stats?.monthlyTrend || []).map(point => point.total)); }
  get comparisonLabel(): string { return this.stats?.comparison?.mode === 'previous-period' ? 'zum vorherigen Zeitraum' : 'zum Vormonat'; }
  get filteredRows(): AdminStatsRow[] {
    const query = this.searchQuery.trim().toLocaleLowerCase('de');
    return (this.stats?.rows || []).filter(row => !query || `${row.name} ${row.slug}`.toLocaleLowerCase('de').includes(query)).sort((a, b) =>
      this.sortBy === 'name' ? a.name.localeCompare(b.name, 'de')
        : this.sortBy === 'change' ? (b.change || 0) - (a.change || 0) || b.total - a.total
        : b.total - a.total || a.name.localeCompare(b.name, 'de'));
  }

  ngOnInit(): void {
    this.demoMode = this.isLocalPreview && this.route.snapshot.queryParamMap.get('beispiel') === '1';
    this.loadStats();
  }
  ngOnDestroy(): void { this.request?.unsubscribe(); }

  loadStats(): void {
    this.request?.unsubscribe();
    this.error = '';
    this.stats = null;
    if (this.period === 'month' && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(this.month) || this.month > this.currentMonth || this.month < '2000-01')) {
      this.error = 'Bitte wähle einen gültigen Monat bis einschließlich des aktuellen Monats.';
      this.isLoading = false;
      return;
    }
    if (this.period === 'all' && this.sortBy === 'change') this.sortBy = 'total';
    this.isLoading = true;
    const source = this.demoMode ? this.statsService.getDemoStats(this.period, this.month) : this.statsService.getStats(this.period, this.month);
    this.request = source.subscribe({
      next: stats => {
        this.stats = stats;
        const previous = stats.comparison;
        this.metrics = [
          { label: 'Buchungen & Anfragen', value: stats.interactionsTotal, previous: previous?.interactionsTotal ?? null, detail: 'Alle gezählten Eingänge' },
          { label: 'Buchungen', value: stats.bookingsTotal, previous: previous?.bookingsTotal ?? null, detail: 'Direkt gebucht oder bestätigt' },
          { label: 'Offene Anfragen', value: stats.requestsTotal, previous: previous?.requestsTotal ?? null, detail: 'Warten auf Bestätigung' },
          { label: 'Aktive Unternehmen', value: stats.activeCompanies, previous: previous?.activeCompanies ?? null, detail: `Von ${stats.companiesTotal} Unternehmen` },
        ];
        this.isLoading = false;
      },
      error: () => { this.error = 'Die Statistiken konnten nicht geladen werden. Bitte versuche es erneut.'; this.isLoading = false; },
    });
  }

  toggleDemo(): void {
    if (!this.isLocalPreview) return;
    this.demoMode = !this.demoMode;
    this.router.navigate([], { relativeTo: this.route, queryParams: { beispiel: this.demoMode ? '1' : null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.loadStats();
  }
  selectMonth(month: string): void { this.month = month; this.period = 'month'; this.loadStats(); }
  onMonthChange(): void { if (this.period === 'month') this.loadStats(); }
  logout(): void { this.authService.logout(); this.router.navigate(['/admin/login']); }
  count(value: number): string { return value.toLocaleString('de-DE'); }
  changeLabel(current: number, previous: number | null): string {
    if (previous === null) return 'Kein Vergleich';
    const percent = statsChangePercent(current, previous);
    return percent === null ? 'Neu' : `${percent > 0 ? '+' : ''}${percent.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
  }
  difference(current: number, previous: number): string { const value = current - previous; return `${value > 0 ? '+' : ''}${this.count(value)}`; }
  dateRange(from: string | null, to: string | null): string {
    if (!from || !to) return 'Gesamter Zeitraum';
    return `${this.formatDate(from)} – ${this.formatDate(to)}`;
  }
  monthLabel(month: string, short = false): string {
    return new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }) }).format(new Date(`${month}-01T00:00:00Z`));
  }
  trackCompany(_index: number, row: AdminStatsRow): string { return row.slug; }
  private formatDate(value: string): string { return value.split('-').reverse().join('.'); }
}
