import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Company {
  id?: string;
  name: string;
  slug: string;
  address: string;
  hours: string;
  breakHours?: string;
  email: string;
  createdAt?: string;
}

export interface CompanyPayload {
  name: string;
  address: string;
  hours: string;
  breakHours?: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class CompanyApiService {
  private readonly baseUrl = '/api/companies';

  constructor(private readonly http: HttpClient) {}

  listCompanies(): Observable<Company[]> {
    return this.http.get<Company[]>(this.baseUrl);
  }

  getCompany(slug: string): Observable<Company | null> {
    return this.http.get<Company>(`${this.baseUrl}?slug=${encodeURIComponent(slug)}`);
  }

  createCompany(payload: CompanyPayload): Observable<Company> {
    return this.http.post<Company>(this.baseUrl, payload);
  }

  updateCompany(slug: string, payload: CompanyPayload): Observable<Company> {
    return this.http.patch<Company>(`${this.baseUrl}?slug=${encodeURIComponent(slug)}`, payload);
  }

  deleteCompany(slug: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}?slug=${encodeURIComponent(slug)}`);
  }
}
