import { CommonModule } from '@angular/common';
import { afterEveryRender, afterNextRender, Component, ElementRef, inject, Injector, OnDestroy, ViewChild, ViewEncapsulation } from '@angular/core';
import { delay, of } from 'rxjs';
import { Company, CompanyApiService } from '../../services/company-api.service';
import { RestaurantPageComponent } from '../restaurant-page/restaurant-page.component';

type ProfileTab = 'booking' | 'services' | 'about';
type SelectionKind = 'service' | 'stylist';

// These fixtures belong only to the localhost UI route. No company settings are saved.
const PREVIEW_COMPANY: Company = {
  id: 'profile-ui-preview', slug: 'atelier7', name: 'Atelier7',
  address: 'Bergmannstraße 12, 90429 Nürnberg',
  hours: 'Di–Fr 10:00–19:00; Sa 09:00–16:00',
  email: 'ui-preview@example.test', serviceType: 'friseur', bookingMode: 'request',
  timeSelectionMode: 'free', slotCapacity: 1, slotIntervalMinutes: 30,
  bookingBufferMinutes: 120, showServicePrices: false, brandColor: '#6963df',
  stylistSelectionEnabled: true, stylists: ['Mara', 'Alex', 'Nila'],
  salonServices: [
    { value: 'herrenhaarschnitt', label: 'Signature Cut', audience: 'men', durationMinutes: 45 },
    { value: 'damenhaarschnitt', label: 'Cut & Styling', audience: 'women', durationMinutes: 60 },
    { value: 'balayage_frauen', label: 'Balayage & Gloss', audience: 'women', durationMinutes: 150 },
    { value: 'waschen_foehnen_frauen', label: 'Wash & Blow Dry', audience: 'women', durationMinutes: 45 },
    { value: 'kinderhaarschnitt_jungen', label: 'Little Ones Cut', audience: 'general', durationMinutes: 30 },
    { value: 'sonstiges', label: 'Zeit für eine Beratung', audience: 'general', durationMinutes: 20 },
  ],
};

@Component({
  selector: 'app-profile-preview',
  standalone: true,
  imports: [CommonModule, RestaurantPageComponent],
  templateUrl: './profile-preview.component.html',
  styleUrls: [
    './profile-preview.component.css', './profile-preview-navigation.css',
    './profile-preview-services.css', './profile-preview-about.css', './profile-preview-overlays.css',
    './profile-preview-booking.css', './profile-preview-fields.css', './profile-preview-responsive.css',
  ],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'profile-preview', '[class.has-booking-dock]': 'showBookingDock' },
  providers: [{
    provide: CompanyApiService,
    useValue: { getCompany: (slug: string) => of(slug === 'atelier7' ? PREVIEW_COMPANY : null).pipe(delay(100)) },
  }],
})
export class ProfilePreviewComponent implements OnDestroy {
  private readonly injector = inject(Injector);
  readonly company = PREVIEW_COMPANY;
  readonly mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(PREVIEW_COMPANY.address);
  @ViewChild(RestaurantPageComponent) booking?: RestaurantPageComponent;
  @ViewChild('galleryDialog') galleryDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('selectionDialog') selectionDialog?: ElementRef<HTMLDialogElement>;
  activeTab: ProfileTab = 'booking';
  serviceCategory = 'all';
  selectionKind: SelectionKind = 'service';
  bookingStarted = false;
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
  readonly tabs: { id: ProfileTab; label: string; icon: string }[] = [
    { id: 'booking', label: 'Termin', icon: 'calendar' },
    { id: 'services', label: 'Leistungen', icon: 'scissors' },
    { id: 'about', label: 'Über uns', icon: 'spark' },
  ];
  readonly categories = [
    { id: 'all', label: 'Alles entdecken' }, { id: 'cut', label: 'Schnitt & Styling' },
    { id: 'color', label: 'Farbe' }, { id: 'care', label: 'Beratung' },
  ];
  readonly services = [
    { value: 'herrenhaarschnitt', title: 'Signature Cut', subtitle: 'Ein Schnitt, der zu dir passt. Inklusive Beratung und Styling.', duration: '45 Min.', category: 'cut', icon: 'scissors', tag: 'Lieblingsservice' },
    { value: 'damenhaarschnitt', title: 'Cut & Styling', subtitle: 'Frischer Schnitt, sanfte Pflege und dein ganz persönliches Finish.', duration: '60 Min.', category: 'cut', icon: 'scissors', tag: '' },
    { value: 'balayage_frauen', title: 'Balayage & Gloss', subtitle: 'Weiche Übergänge. Natürliches Leuchten. Individuell für dein Haar.', duration: '150 Min.', category: 'color', icon: 'spark', tag: 'Our signature' },
    { value: 'waschen_foehnen_frauen', title: 'Wash & Blow Dry', subtitle: 'Eine kleine Auszeit mit einem richtig guten Haargefühl.', duration: '45 Min.', category: 'cut', icon: 'spark', tag: '' },
    { value: 'kinderhaarschnitt_jungen', title: 'Little Ones Cut', subtitle: 'Mit Geduld, guter Laune und einem Schnitt für kleine Köpfe.', duration: '30 Min.', category: 'cut', icon: 'scissors', tag: '' },
    { value: 'sonstiges', title: 'Zeit für eine Beratung', subtitle: 'Ein neuer Look im Kopf? Wir hören zu und denken mit.', duration: '20 Min.', category: 'care', icon: 'coffee', tag: '' },
  ];
  readonly gallery = [
    { file: 'salon-hero.jpg', title: 'Ein Ort zum Ankommen', alt: 'Helles Saloninterieur mit Rundbogenspiegeln und warmen Naturmaterialien' },
    { file: 'salon-detail.jpg', title: 'Dein Platz für eine kleine Auszeit', alt: 'Einblick in einen modernen Friseursalon' },
    { file: 'hair-story.jpg', title: 'Mit Liebe zum Handwerk', alt: 'Persönliches Hairstyling im Salon' },
  ];
  readonly hours = this.company.hours.split(/[;\n]+/).map(value => value.trim()).filter(Boolean).map(value => {
    const match = value.match(/^(.*?)\s+(\d.*|geschlossen)$/i);
    return match ? { day: match[1], hours: match[2] } : { day: value, hours: '' };
  });

  get filteredServices() { return this.services.filter(service => this.serviceCategory === 'all' || service.category === this.serviceCategory); }
  get selectedService() { return this.services.find(service => service.value === this.booking?.bookingForm.controls.service.value); }
  get currentImage() { return this.gallery[this.galleryIndex]; }
  get showBookingDock() { return this.activeTab !== 'booking' || (!this.bookingStarted && !this.booking?.hasSelectedDate); }

  setTab(tab: ProfileTab): void {
    if (tab === 'booking') { this.goBooking(); return; }
    const identity = document.querySelector('.profile-preview .profile-identity');
    const navigationTop = identity ? identity.getBoundingClientRect().bottom + window.scrollY : 0;
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
    this.booking?.bookingForm.controls.service.setValue(value);
    this.goBooking();
  }
  goBooking(): void {
    this.activeTab = 'booking';
    this.bookingStarted = true;
    afterNextRender(() => this.scrollToBooking(), { injector: this.injector });
  }
  private scrollToBooking(): void {
    const selector = this.booking?.activeFlowStep === 'details' ? '.booking-shell .booking-flow' : '.booking-shell';
    const target = document.querySelector('.profile-preview ' + selector);
    target?.scrollIntoView({ behavior: this.reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }
  async share(): Promise<void> {
    try { await navigator.clipboard.writeText(window.location.href); this.notify('Salonlink kopiert.'); }
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
  openGallery(index = 0): void { this.galleryIndex = index; this.galleryDialog?.nativeElement.showModal(); }
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
  ngOnDestroy(): void { clearTimeout(this.toastTimer); }
}
