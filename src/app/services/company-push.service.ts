import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { CompanyAuthService } from './company-auth.service';

export type CompanyPushState =
  | 'loading'
  | 'ready'
  | 'enabled'
  | 'denied'
  | 'install-required'
  | 'unsupported'
  | 'not-configured'
  | 'error';

type PushConfiguration = {
  configured: boolean;
  publicKey: string | null;
};

@Injectable({ providedIn: 'root' })
export class CompanyPushService {
  private readonly endpoint = '/api/company/push-subscriptions';
  private registration: ServiceWorkerRegistration | null = null;
  private publicKey = '';

  constructor(
    private readonly http: HttpClient,
    private readonly authService: CompanyAuthService,
  ) {}

  async initialize(): Promise<CompanyPushState> {
    if (this.isLocalMock()) {
      return 'not-configured';
    }
    if (!this.isSupported()) {
      return this.isIos() && !this.isStandalone() ? 'install-required' : 'unsupported';
    }
    if (this.isIos() && !this.isStandalone()) {
      return 'install-required';
    }
    if (Notification.permission === 'denied') {
      return 'denied';
    }

    try {
      this.registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
      const configuration = await firstValueFrom(
        this.http.get<PushConfiguration>(this.endpoint, { headers: this.authHeaders() }),
      );
      if (!configuration.configured || !configuration.publicKey) {
        return 'not-configured';
      }
      this.publicKey = configuration.publicKey;
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await this.saveSubscription(subscription);
      }
      return subscription ? 'enabled' : 'ready';
    } catch {
      return 'error';
    }
  }

  async enable(): Promise<CompanyPushState> {
    if (!this.registration || !this.publicKey) {
      return 'error';
    }
    try {
      // Der Permission-Aufruf muss auf iOS unmittelbar aus dem Button-Klick entstehen.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return permission === 'denied' ? 'denied' : 'ready';
      }
      const existing = await this.registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.publicKey),
        }));
      await this.saveSubscription(subscription);
      return 'enabled';
    } catch {
      return Notification.permission === 'denied' ? 'denied' : 'error';
    }
  }

  async disable(): Promise<CompanyPushState> {
    if (!this.registration) {
      return 'ready';
    }
    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await firstValueFrom(
          this.http.delete(this.endpoint, {
            headers: this.authHeaders(),
            body: { endpoint: subscription.endpoint },
          }),
        );
        await subscription.unsubscribe();
      }
      await this.clearBadge();
      return 'ready';
    } catch {
      return 'error';
    }
  }

  async clearBadge(): Promise<void> {
    const badgeNavigator = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
    if (typeof badgeNavigator.clearAppBadge === 'function') {
      try {
        await badgeNavigator.clearAppBadge();
      } catch {
        // Ein fehlendes Badge darf den Kalender nicht beeinflussen.
      }
    }
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.getAuthToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  private async saveSubscription(subscription: PushSubscription): Promise<void> {
    await firstValueFrom(
      this.http.post(
        this.endpoint,
        { subscription: subscription.toJSON() },
        { headers: this.authHeaders() },
      ),
    );
  }

  private isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  private isIos(): boolean {
    return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  private isStandalone(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const iosNavigator = navigator as Navigator & { standalone?: boolean };
    return (
      window.matchMedia('(display-mode: standalone)').matches || iosNavigator.standalone === true
    );
  }

  private isLocalMock(): boolean {
    return (
      environment.mockApi &&
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost'
    );
  }

  private urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let index = 0; index < raw.length; index += 1) {
      bytes[index] = raw.charCodeAt(index);
    }
    return bytes;
  }
}
