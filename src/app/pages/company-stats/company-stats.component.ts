import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './company-stats.component.html',
})
export class CompanyStatsComponent implements OnInit {
  readonly periodOptions: Array<{ value: CompanyStatsPeriod; label: string }> = [
    { value: 30, label: 'Letzte 30 Tage' },
    { value: 90, label: 'Letzte 90 Tage' },
    { value: 365, label: 'Letzte 12 Monate' },
  ];

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
}
