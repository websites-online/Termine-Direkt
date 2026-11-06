import { CommonModule } from '@angular/common';
import { afterEveryRender, afterNextRender, Component, ElementRef, inject, Injector, isDevMode, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Subscription, switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { CompanyProfile, defaultCompanyProfile, hasProCompanyProfile, normalizeCompanyProfile } from '../../shared/company-profile';
import { LOCAL_PROFILE_PREVIEW, PublicBookingService } from '../../services/public-booking.service';
import { SALON_SERVICES } from '../../shared/salon-services';
import { Company, CompanyApiService } from '../../services/company-api.service';
import { RestaurantPageComponent } from '../restaurant-page/restaurant-page.component';

type ProfileTab = 'booking' | 'services' | 'photos' | 'about';
type SelectionKind = 'service' | 'stylist';

interface PreviewService {
  value: string; title: string; subtitle: string; duration: string;
  category: string; icon: string; tag: string; price?: number;
}

@Component({
  selector: 'app-profile-preview',
  standalone: true,
  imports: [CommonModule, RestaurantPageComponent],
  templateUrl: './profile-preview.component.html',
  styleUrls: [
    './profile-preview.component.css', './profile-preview-navigation.css',
    './profile-preview-services.css', './profile-preview-menu.css', './profile-preview-photos.css', './profile-preview-about.css', './profile-preview-overlays.css',
    './profile-preview-booking.css', './profile-preview-fields.css', './profile-preview-responsive.css',
    './profile-preview-success.css',
  ],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'profile-preview', '[class.has-booking-dock]': 'showBookingDock', '[class.is-restaurant]': 'isRestaurant',
    '[class.has-pro-profile]': 'hasProProfile',
    '[style.--profile-tab-count]': 'tabs.length',
    '[style.--brand-color]': 'booking?.brandColor || company?.brandColor',
    '[style.--brand-rgb]': "booking?.brandColorRgb || '79, 70, 229'",
    '[style.--brand-dark]': "booking?.brandColorDark || '#3c35ae'",
    '[style.--brand-text]': "booking?.brandTextColor || '#ffffff'",
  },
  providers: [CompanyApiService, PublicBookingService, {
    provide: LOCAL_PROFILE_PREVIEW,
    useFactory: () => inject(ActivatedRoute).snapshot.data['localProfilePreview'] === true &&
      isDevMode() && typeof window !== 'undefined' && window.location.hostname === 'localhost',
  }],
})
export class ProfilePreviewComponent implements OnInit, OnDestroy {
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly companies = inject(CompanyApiService);
  private readonly subscription = new Subscription();
  readonly isLocalDesignPreview = inject(PublicBookingService).profilePreview;
  company?: Company;
  profile: CompanyProfile = normalizeCompanyProfile(undefined);
  loading = true;
  get hasProProfile(): boolean { return hasProCompanyProfile(this.company?.planTier); }
  get isRestaurant(): boolean { return this.company?.serviceType === 'restaurant'; }
  get bookingLabel(): string { return this.isRestaurant ? 'Tisch reservieren' : 'Termin anfragen'; }
  get mapUrl(): string { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(this.company?.address || ''); }
  @ViewChild(RestaurantPageComponent) booking?: RestaurantPageComponent;
  @ViewChild('galleryDialog') galleryDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('selectionDialog') selectionDialog?: ElementRef<HTMLDialogElement>;
  activeTab: ProfileTab = 'booking';
  serviceCategory = 'all';
  selectionKind: SelectionKind = 'service';
  galleryIndex = 0;
  toast = '';
  private toastTimer?: ReturnType<typeof setTimeout>;
  private lastBookingStep?: 'date' | 'details';

  constructor() {
    afterEveryRender(() => {
      const step = this.booking?.activeFlowStep;
      if (this.lastBookingStep && step !== this.lastBookingStep && this.activeTab === 'booking') {
        requestAnimationFrame(() => this.scrollToBooking());
      }
      this.lastBookingStep = step;
    });
  }
  tabs: { id: ProfileTab; label: string; icon: string }[] = [];
  categories: { id: string; label: string }[] = [];
  services: PreviewService[] = [];
  hours: { day: string; hours: string }[] = [];
  get gallery() { return this.hasProProfile ? this.profile.photos : []; }
  get filteredMenu() { return this.profile.menu.filter(item => this.serviceCategory === 'all' || item.category === this.serviceCategory); }
  price(value: number): string { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value); }

  ngOnInit(): void {
    this.subscription.add(this.route.paramMap.pipe(switchMap(params => {
      this.company = undefined;
      this.loading = true;
      this.activeTab = 'booking';
      this.serviceCategory = 'all';
      return this.companies.getCompany(params.get('slug') || '');
    })).subscribe({
      next: company => {
        this.loading = false;
        if (!company) return;
        this.company = company;
        this.profile = company.profile !== undefined ? normalizeCompanyProfile(company.profile) : defaultCompanyProfile(company.serviceType);
        this.tabs = [
          { id: 'booking', label: 'Termin', icon: 'calendar' },
          ...(this.hasProProfile ? [
            { id: 'services' as const, label: this.isRestaurant ? 'Speisekarte' : 'Leistungen', icon: this.isRestaurant ? 'menu' : 'scissors' },
            ...(this.gallery.length ? [{ id: 'photos' as const, label: 'Fotos', icon: 'grid' }] : []),
            { id: 'about' as const, label: 'Über uns', icon: 'spark' },
          ] : []),
        ];
        const configured = company.salonServices?.length ? company.salonServices : SALON_SERVICES;
        this.services = this.isRestaurant ? [] : configured.map(service => ({
          value: service.value, title: service.label,
          subtitle: this.profile.serviceDescriptions[service.value] || '',
          duration: service.durationMinutes ? `${service.durationMinutes} Min.` : '',
          category: service.audience, icon: 'scissors', tag: '', price: service.price,
        }));
        this.categories = this.isRestaurant
          ? [{ id: 'all', label: 'Alles entdecken' }, ...Array.from(new Set(this.profile.menu.map(item => item.category))).map(category => ({ id: category, label: category }))]
          : [{ id: 'all', label: 'Alle Leistungen' }, ...[
              { id: 'women', label: 'Damen' }, { id: 'men', label: 'Herren' }, { id: 'general', label: 'Für alle' },
            ].filter(category => this.services.some(service => service.category === category.id))];
        this.hours = company.hours.split(/[;\n]+/).map(value => value.trim()).filter(Boolean).map(value => {
          const match = value.match(/^(.*?)\s+(\d.*|geschlossen)$/i);
          return match ? { day: match[1], hours: match[2] } : { day: value, hours: '' };
        });
      },
      error: () => { this.loading = false; },
    }));
  }

  get filteredServices() { return this.services.filter(service => this.serviceCategory === 'all' || service.category === this.serviceCategory); }
  get selectedService() { return this.services.find(service => service.value === this.booking?.bookingForm.controls.service.value); }
  get currentImage() { return this.gallery[this.galleryIndex]; }
  get showBookingDock() { return this.activeTab !== 'booking'; }

  setTab(tab: ProfileTab): void {
    if (!this.tabs.some(item => item.id === tab)) return;
    if (tab === 'booking') { this.goBooking(); return; }
    const intro = document.querySelector('.profile-preview .profile-welcome');
    const navigationTop = intro ? intro.getBoundingClientRect().bottom + window.scrollY : 0;
    const shouldScroll = window.scrollY > navigationTop + 20;
    this.activeTab = tab;
    if (shouldScroll) requestAnimationFrame(() => {
      window.scrollTo({ top: navigationTop, behavior: this.reducedMotion ? 'auto' : 'smooth' });
    });
  }
  onTabKey(event: KeyboardEvent, index: number): void {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!offset && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1 : (index + offset + this.tabs.length) % this.tabs.length;
    this.setTab(this.tabs[next].id);
    document.getElementById(`profile-tab-${this.activeTab}`)?.focus();
  }
  bookService(value: string): void {
    if (!this.hasProProfile) return;
    this.booking?.bookingForm.controls.service.setValue(value);
    this.goBooking();
  }
  goBooking(): void {
    this.activeTab = 'booking';
    afterNextRender(() => this.scrollToBooking(), { injector: this.injector });
  }
  private scrollToBooking(): void {
    const behavior = this.reducedMotion ? 'auto' : 'smooth';
    if (this.booking?.activeFlowStep === 'details') {
      document.querySelector('.profile-preview .booking-flow')?.scrollIntoView({ behavior, block: 'start' });
    } else if (this.booking?.hasSelectedDate) {
      document.querySelector('.profile-preview .booking-shell')?.scrollIntoView({ behavior, block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  }
  async share(): Promise<void> {
    try { await navigator.clipboard.writeText(window.location.href); this.notify(this.isRestaurant ? 'Restaurantlink kopiert.' : 'Salonlink kopiert.'); }
    catch { this.notify('Der Link konnte nicht kopiert werden. Du kannst ihn aus der Adresszeile kopieren.'); }
  }
  get selectedStylistLabel(): string {
    const value = this.booking?.bookingForm.controls.stylist.value;
    return this.booking?.stylistChoices.find(choice => choice.value === value)?.label || 'Keine Präferenz';
  }
  get selectionOptions(): Array<{ value: string; label: string; detail?: string }> {
    if (this.selectionKind === 'stylist') {
      return [{ value: '', label: 'Keine Präferenz' }, ...(this.booking?.stylistChoices || [])];
    }
    return (this.booking?.salonServices || []).map(service => ({
      value: service.value, label: service.label,
      detail: service.durationMinutes ? `${service.durationMinutes} Min.` : undefined,
    }));
  }
  get selectionValue(): string {
    return this.booking?.bookingForm.controls[this.selectionKind].value || '';
  }
  openSelection(kind: SelectionKind): void {
    this.selectionKind = kind;
    this.selectionDialog?.nativeElement.showModal();
  }
  chooseSelection(value: string): void {
    const control = this.booking?.bookingForm.controls[this.selectionKind];
    control?.setValue(value);
    control?.markAsDirty();
    control?.markAsTouched();
    this.closeSelection();
  }
  closeSelection(): void { this.selectionDialog?.nativeElement.close(); }
  onSelectionClosed(): void { this.booking?.bookingForm.controls[this.selectionKind].markAsTouched(); }
  openGallery(index = 0): void {
    if (!this.hasProProfile || !this.gallery.length) return;
    this.galleryIndex = index; this.galleryDialog?.nativeElement.showModal();
  }
  closeGallery(): void { this.galleryDialog?.nativeElement.close(); }
  galleryStep(offset: number): void { this.galleryIndex = (this.galleryIndex + offset + this.gallery.length) % this.gallery.length; }
  galleryKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); this.galleryStep(event.key === 'ArrowRight' ? 1 : -1);
    }
  }
  notify(message: string): void {
    clearTimeout(this.toastTimer); this.toast = message;
    this.toastTimer = setTimeout(() => this.toast = '', 3600);
  }
  private get reducedMotion(): boolean { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  ngOnDestroy(): void { clearTimeout(this.toastTimer); this.subscription.unsubscribe(); }
}
