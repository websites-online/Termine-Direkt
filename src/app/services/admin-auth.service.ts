import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, tap, throwError } from 'rxjs';

import { environment } from '../../environments/environment';

interface AdminLoginResponse {
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {
  private readonly tokenKey = 'admin_token';
  private readonly loginUrl = `${environment.API_BASE_URL}/api/admin/login`;

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<boolean> {
    if (environment.mockApi) {
      if (email !== environment.ADMIN_EMAIL || password.length < 6) {
        return throwError(() => new Error('Nicht berechtigt.'));
      }

      // TODO: Backend endpoint required
      return of(true).pipe(tap(() => this.storeToken('mock')));
    }

    return this.http.post<AdminLoginResponse>(this.loginUrl, { email, password }).pipe(
      tap((response) => this.storeToken(response.token)),
      map(() => true)
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem(this.tokenKey));
  }

  private storeToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }
}
