import { Injectable } from '@angular/core';

export interface Company {
  name: string;
  slug: string;
  address: string;
  hours: string;
  breakHours?: string;
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

  addCompany(data: {
    name: string;
    address: string;
    hours: string;
    breakHours?: string;
    email?: string;
  }): Company {
    const slug = this.createSlug(data.name);
    const companies = this.getCompanies();
    const uniqueSlug = this.ensureUniqueSlug(slug, companies);
    const company: Company = {
      name: data.name,
      slug: uniqueSlug,
      address: data.address,
      hours: data.hours,
      breakHours: data.breakHours,
      email: data.email || 'kontakt@example.com',
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

  updateCompany(
    slug: string,
    updates: { name: string; address: string; hours: string; breakHours?: string; email?: string }
  ): Company | undefined {
    const companies = this.getCompanies();
    const targetIndex = companies.findIndex((company) => company.slug === slug);
    if (targetIndex === -1) {
      return undefined;
    }

    const current = companies[targetIndex];
    const baseSlug = this.createSlug(updates.name);
    const otherCompanies = companies.filter((company) => company.slug !== slug);
    const nextSlug = this.ensureUniqueSlug(baseSlug, otherCompanies);
    const updated: Company = {
      ...current,
      name: updates.name,
      slug: nextSlug,
      address: updates.address,
      hours: updates.hours,
      breakHours: updates.breakHours,
      email: updates.email || current.email
    };

    const nextCompanies = [...companies];
    nextCompanies[targetIndex] = updated;
    localStorage.setItem(this.storageKey, JSON.stringify(nextCompanies));
    return updated;
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
