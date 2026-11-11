import type { CompanyStatsResponse } from '../services/company-stats.service';

/** Monatspreis des Pro-Tarifs – Grundlage der Rendite-Rechnung. */
export const PRO_PLAN_PRICE = 24.99;

export interface RevenueEstimate {
  amount: number;
  bookings: number;
  changeLabel: string;
  changeNegative: boolean;
  roi: number;
}

/** Gleicher Schlüssel wie auf der Statistik-Seite, damit beide Ansichten denselben Wert nutzen. */
export function ticketKey(slug?: string | null): string {
  return `nextime.avg-ticket.${slug || 'default'}`;
}

export function readAvgTicket(slug: string | undefined | null, isSalon: boolean): number {
  const fallback = isSalon ? 35 : 60;
  try {
    const stored = Number(localStorage.getItem(ticketKey(slug)));
    return Number.isFinite(stored) && stored > 0 ? stored : fallback;
  } catch {
    return fallback;
  }
}

/** Anzahl Termine, die in die Schätzung einfließen (bei Anfrage-Modus nur angenommene). */
export function revenueBookings(stats: CompanyStatsResponse): number {
  if (stats.eventKind === 'request' && stats.conversion.trackingAvailable) {
    return Math.min(stats.total, stats.conversion.completions);
  }
  return stats.total;
}

export function estimateRevenue(stats: CompanyStatsResponse, ticket: number): RevenueEstimate {
  const bookings = revenueBookings(stats);
  const amount = bookings * ticket;
  const months = Math.max(1, stats.period / 30);
  let changeLabel = amount > 0 ? 'Neu im Vergleich zum Zeitraum davor' : 'Noch keine Buchungen';
  if (stats.previousTotal > 0) {
    const previous = stats.previousTotal * ticket;
    const change = Math.round(((amount - previous) / previous) * 100);
    changeLabel = `${change > 0 ? '+' : ''}${change} % zum Zeitraum davor`;
  }
  return {
    amount,
    bookings,
    changeLabel,
    changeNegative: stats.previousTotal > stats.total,
    roi: Math.round((amount / (PRO_PLAN_PRICE * months)) * 10) / 10,
  };
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
