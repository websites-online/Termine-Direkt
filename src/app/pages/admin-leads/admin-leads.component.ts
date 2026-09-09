import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { AdminAuthService } from '../../services/admin-auth.service';
import {
  AdminLeadsService,
  LeadCategory,
  LeadStatus,
  SalesLead,
} from '../../services/admin-leads.service';

type ContactFilter = 'all' | 'email' | 'phone';
type StatusFilter = LeadStatus | 'all' | 'open';

@Component({
  selector: 'app-admin-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-leads.component.html',
})
export class AdminLeadsComponent implements OnInit {
  readonly statusOptions: Array<{ value: LeadStatus; label: string }> = [
    { value: 'new', label: 'Neu' },
    { value: 'reviewed', label: 'Geprüft' },
    { value: 'contacted', label: 'Kontaktiert' },
    { value: 'replied', label: 'Antwort erhalten' },
    { value: 'customer', label: 'Kunde geworden' },
    { value: 'no_interest', label: 'Kein Interesse' },
    { value: 'excluded', label: 'Ausgeschlossen' },
  ];

  leads: SalesLead[] = [];
  search = '';
  statusFilter: StatusFilter = 'open';
  categoryFilter: LeadCategory | 'all' = 'all';
  contactFilter: ContactFilter = 'all';
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  updatingIds = new Set<string>();

  constructor(
    private readonly leadsService: AdminLeadsService,
    private readonly authService: AdminAuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadLeads();
  }

  loadLeads(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.leadsService.listLeads().subscribe({
      next: (leads) => {
        this.leads = leads;
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        if (error?.status === 401) {
          this.authService.logout();
          this.router.navigate(['/admin/login']);
          return;
        }
        this.errorMessage =
          error?.error?.error || 'Die Leads konnten momentan nicht geladen werden.';
      },
    });
  }

  get visibleLeads(): SalesLead[] {
    const query = this.search.trim().toLocaleLowerCase('de');
    return this.leads.filter((lead) => {
      const matchesQuery =
        !query ||
        [lead.name, lead.city, lead.postcode, lead.email, lead.phone]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase('de').includes(query));
      const matchesStatus =
        this.statusFilter === 'all' ||
        (this.statusFilter === 'open'
          ? ['new', 'reviewed', 'contacted', 'replied'].includes(lead.status)
          : lead.status === this.statusFilter);
      const matchesCategory =
        this.categoryFilter === 'all' || lead.category === this.categoryFilter;
      const matchesContact =
        this.contactFilter === 'all' ||
        (this.contactFilter === 'email' ? Boolean(lead.email) : Boolean(lead.phone));
      return matchesQuery && matchesStatus && matchesCategory && matchesContact;
    });
  }

  get newCount(): number {
    return this.leads.filter((lead) => lead.status === 'new').length;
  }

  get emailCount(): number {
    return this.leads.filter((lead) => Boolean(lead.email) && lead.status !== 'excluded').length;
  }

  get phoneCount(): number {
    return this.leads.filter((lead) => Boolean(lead.phone) && lead.status !== 'excluded').length;
  }

  get highConfidenceCount(): number {
    return this.leads.filter(
      (lead) => lead.confidence >= 80 && !['excluded', 'no_interest'].includes(lead.status),
    ).length;
  }

  updateStatus(lead: SalesLead, status: LeadStatus): void {
    if (lead.status === status || this.updatingIds.has(lead.id)) {
      return;
    }
    this.updatingIds.add(lead.id);
    this.errorMessage = '';
    this.leadsService.updateLead(lead.id, status, lead.notes).subscribe({
      next: (updated) => {
        this.updatingIds.delete(lead.id);
        this.replaceLead(updated);
        this.successMessage = `${lead.name}: Status wurde aktualisiert.`;
      },
      error: (error) => {
        this.updatingIds.delete(lead.id);
        this.errorMessage = error?.error?.error || 'Status konnte nicht gespeichert werden.';
      },
    });
  }

  prepareEmail(lead: SalesLead): void {
    if (!lead.email) {
      return;
    }
    const isSalon = lead.category === 'friseur';
    const exampleName = isSalon ? 'Atelier7' : 'Osteria da Michele in Fürth';
    const exampleUrl = isSalon
      ? 'https://nextime-booking.de/atelier7'
      : 'https://nextime-booking.de/osteria-da-michele';
    const subject = `Eine Idee für ${lead.name}`;
    const body = [
      `Hallo liebes Team von ${lead.name},`,
      '',
      `ich bin Daniel aus Nürnberg und habe Nextime als eigenes Projekt entwickelt. Gerade suche ich in der Umgebung nach ein paar sympathischen ${
        isSalon ? 'Friseursalons' : 'Restaurants'
      }, die meine Buchungssoftware kostenlos ausprobieren und mir ehrliches Feedback geben möchten.`,
      '',
      `Dabei bin ich auf ${lead.name} gestoßen und dachte, dass es gut passen könnte. Sie bekommen eine eigene Buchungsseite, über die Ihre ${
        isSalon ? 'Kunden unkompliziert Termine' : 'Gäste unkompliziert Reservierungen'
      } eintragen können.`,
      '',
      'Die ersten 3 Monate sind komplett kostenlos und unverbindlich. Danach kostet Nextime 18,99 € pro Monat – natürlich nur, wenn Sie es weiter nutzen möchten.',
      '',
      `So sieht das zum Beispiel bei ${exampleName} aus:`,
      exampleUrl,
      '',
      'Wenn Sie möchten, kann ich auch gerne bei Ihnen vorbeikommen und Ihnen Nextime vor Ort zeigen.',
      '',
      'Wenn Sie Lust haben, es auszuprobieren, antworten Sie mir einfach kurz. Ich richte Ihnen alles ein.',
      '',
      'Viele Grüße',
      'Daniel von Nextime',
      'https://nextime-booking.de',
      '',
      'Falls Sie keine weitere Nachricht wünschen, genügt eine kurze Rückmeldung.',
    ].join('\n');
    window.location.href = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    if (lead.status === 'new') {
      this.updateStatus(lead, 'reviewed');
    }
  }

  copyPhone(lead: SalesLead): void {
    if (!lead.phone) {
      return;
    }
    navigator.clipboard?.writeText(lead.phone).then(() => {
      this.successMessage = `${lead.phone} wurde kopiert.`;
    });
  }

  statusLabel(status: LeadStatus): string {
    return this.statusOptions.find((option) => option.value === status)?.label || status;
  }

  categoryLabel(category: LeadCategory): string {
    return category === 'friseur' ? 'Friseur' : 'Restaurant';
  }

  confidenceLabel(value: number): string {
    return value >= 80 ? 'Hohe Sicherheit' : value >= 55 ? 'Bitte kurz prüfen' : 'Unklar';
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(date);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  trackByLead(_index: number, lead: SalesLead): string {
    return lead.id;
  }

  private replaceLead(updated: SalesLead): void {
    this.leads = this.leads.map((lead) => (lead.id === updated.id ? updated : lead));
  }
}
