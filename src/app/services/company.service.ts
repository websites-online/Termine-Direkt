import { Injectable } from '@angular/core';

export interface Company {
  name: string;
  slug: string;
  address: string;
  hours: string;
  email: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class CompanyService {
  private readonly storageKey = 'companies';

  getCompanies(): Company[] {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) {
      return [];
    }

    try {
      return JSON.parse(stored) as Company[];
    } catch {
      return [];
    }
  }

  addCompany(name: string): Company {
    const slug = this.createSlug(name);
    const companies = this.getCompanies();
    const uniqueSlug = this.ensureUniqueSlug(slug, companies);
    const company: Company = {
      name,
      slug: uniqueSlug,
      address: 'Beispielstraße 12, 12345 Musterstadt',
      hours: 'Di–So 12:00–20:00 · Montag geschlossen',
      email: 'kontakt@example.com',
      createdAt: new Date().toISOString()
    };
    const updated = [...companies, company];
    localStorage.setItem(this.storageKey, JSON.stringify(updated));
    return company;
  }

  findBySlug(slug: string): Company | undefined {
    return this.getCompanies().find((company) => company.slug === slug);
  }

  deleteCompany(slug: string): void {
    const companies = this.getCompanies().filter((company) => company.slug !== slug);
    localStorage.setItem(this.storageKey, JSON.stringify(companies));
  }

  private createSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private ensureUniqueSlug(slug: string, companies: Company[]): string {
    if (!companies.some((company) => company.slug === slug)) {
      return slug;
    }

    let suffix = 2;
    let candidate = `${slug}-${suffix}`;

    while (companies.some((company) => company.slug === candidate)) {
      suffix += 1;
      candidate = `${slug}-${suffix}`;
    }

    return candidate;
  }
}
