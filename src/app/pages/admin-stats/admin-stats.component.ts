import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { AdminAuthService } from '../../services/admin-auth.service';
import { AdminStatsPeriod, AdminStatsResponse, AdminStatsService } from '../../services/admin-stats.service';

@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-stats.component.html',
  styleUrl: './admin-stats.component.css'
})
export class AdminStatsComponent implements OnInit {
  readonly periodOptions: Array<{ value: AdminStatsPeriod; label: string }> = [
    { value: 'this-month', label: 'Diesen Monat' },
    { value: 'last-30-days', label: 'Letzte 30 Tage' },
    { value: 'month', label: 'Bestimmter Monat' },
    { value: 'all', label: 'Gesamt' }
  ];

  period: AdminStatsPeriod = 'this-month';
  month = this.createCurrentMonthValue();
  isLoading = false;
  error = '';
  stats: AdminStatsResponse | null = null;

  constructor(
    private readonly statsService: AdminStatsService,
    private readonly authService: AdminAuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.isLoading = true;
    this.error = '';
    this.statsService.getStats(this.period, this.month).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Statistiken konnten nicht geladen werden.';
        this.isLoading = false;
      }
    });
  }

  onPeriodChange(): void {
    this.loadStats();
  }

  onMonthChange(): void {
    if (this.period === 'month') {
      this.loadStats();
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  formatRangeLabel(): string {
    if (!this.stats?.from || !this.stats.to) {
      return 'Zeitraum: Gesamt';
    }
    return `Zeitraum: ${this.formatDate(this.stats.from)} bis ${this.formatDate(this.stats.to)}`;
  }

  private formatDate(value: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return value;
    }
    return `${match[3]}.${match[2]}.${match[1]}`;
  }

  private createCurrentMonthValue(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

