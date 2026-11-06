import { Component, OnInit, inject, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AdminAuthService } from '../../services/admin-auth.service';
import {
  CalendarMode,
  Company,
  CompanyApiService,
  TimeSelectionMode,
} from '../../services/company-api.service';
import {
  CompanyEmployee,
  SalonServiceAudience,
  SalonServiceOption,
} from '../../shared/salon-services';

import { CompanyProfileEditorComponent } from '../../components/company-profile-editor/company-profile-editor.component';
import { CompanyProfile, defaultCompanyProfile } from '../../shared/company-profile';

type SalonServiceSetting = SalonServiceOption;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, CompanyProfileEditorComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css', './admin-overview.css'],
})
export class AdminDashboardComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  companies: Company[] = [];
  editingSlug: string | null = null;
  readonly standaloneEditSlug: string | null;
  readonly isCreatingCompany: boolean;
  isLoadingCompanies = false;
  companyListError = '';
  searchQuery = '';
  companyFilter: 'all' | 'friseur' | 'restaurant' = 'all';
  isSaving = false;
  isProcessingLogo = false;
  formError = '';
  formSuccess = '';
  logoError = '';
  salonServiceSettings: SalonServiceSetting[] = this.createDefaultSalonServiceSettings();
  employeeSettings: CompanyEmployee[] = [];
  readonly companyForm = this.formBuilder.group({
    profile: this.formBuilder.control<CompanyProfile>(defaultCompanyProfile('restaurant'), { nonNullable: true }),
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: ['Beispielstraße 12, 12345 Musterstadt', Validators.required],
    hours: ['Mo–So 12:00–20:00', Validators.required],
    breakHours: [''],
    email: ['kontakt@example.com', [Validators.required, Validators.email]],
    splitServiceEmails: [false],
    womenServicesEmail: [''],
    serviceType: ['restaurant', Validators.required],
    bookingMode: ['confirm', Validators.required],
    planTier: ['starter', Validators.required],
    calendarMode: ['shared', Validators.required],
    seatingOptionsEnabled: [false],
    stylistSelectionEnabled: [false],
    stylistsText: [''],
    showServicePrices: [false],
    loginPin: [''],
    slotCapacity: [3, [Validators.required, Validators.min(1), Validators.max(3)]],
    slotIntervalMinutes: [45, Validators.required],
    bookingBufferMinutes: [120, [Validators.required, Validators.min(0), Validators.max(1440)]],
    timeSelectionMode: ['slots', Validators.required],
    logoUrl: [''],
    brandColor: ['#4f46e5', [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
  });

  constructor(
    private readonly authService: AdminAuthService,
    private readonly router: Router,
    private readonly companyService: CompanyApiService,
    private readonly route: ActivatedRoute,
  ) {
    this.standaloneEditSlug = this.route.snapshot.paramMap.get('slug');
    this.isCreatingCompany = this.route.snapshot.data['createCompany'] === true;
  }

  get isEditorView(): boolean {
    return this.isCreatingCompany || this.standaloneEditSlug !== null;
  }

  get filteredCompanies(): Company[] {
    const query = this.searchQuery.trim().toLocaleLowerCase('de');
    return this.companies.filter(company =>
      (this.companyFilter === 'all' || company.serviceType === this.companyFilter) &&
      (!query || `${company.name} ${company.address || ''} ${company.slug}`.toLocaleLowerCase('de').includes(query)),
    );
  }

  companyCount(type: 'friseur' | 'restaurant'): number {
    return this.companies.filter(company => company.serviceType === type).length;
  }

  updateSearch(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.companyFilter = 'all';
  }

  retryLoading(): void {
    this.loadCompanies();
  }

  ngOnInit(): void {
    this.resetForm();
    this.companyForm.valueChanges.subscribe(() => {
      this.updateWomenServicesEmailValidators();
      this.formSuccess = '';
    });
    this.companyForm.get('calendarMode')?.valueChanges.subscribe((mode) => {
      if (mode !== 'employee' || this.employeeSettings.length > 0) {
        return;
      }
      this.employeeSettings = this.parseStylistNames(this.companyForm.value.stylistsText).map(
        (name, index) => this.createEmployee(name, index),
      );
      if (this.employeeSettings.length === 0) {
        this.addEmployee();
      }
    });
    this.companyForm.controls.serviceType.valueChanges.subscribe(type => {
      const profile = this.companyForm.controls.profile.value;
      const defaults = defaultCompanyProfile(type || 'restaurant');
      this.companyForm.controls.profile.setValue({
        ...profile,
        offeringsTitle: ['Unsere Leistungen', 'Unsere Speisekarte'].includes(profile.offeringsTitle) ? defaults.offeringsTitle : profile.offeringsTitle,
        welcomeSubtitle: ['Dein Termin. Ganz entspannt.', 'Ein guter Abend beginnt hier.'].includes(profile.welcomeSubtitle) ? defaults.welcomeSubtitle : profile.welcomeSubtitle,
      }, { emitEvent: false });
    });
    this.updateWomenServicesEmailValidators();
    this.loadCompanies();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }

  submitCompany(): void {
    this.formError = '';
    this.formSuccess = '';
    this.updateWomenServicesEmailValidators();
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      this.formError = 'Bitte die markierten Angaben prüfen und laufende Bild-Uploads abwarten.';
      return;
    }

    const value = this.companyForm.value;
    const serviceType = (value.serviceType || 'restaurant') as 'restaurant' | 'friseur';
    const splitServiceEmails = serviceType === 'friseur' && value.splitServiceEmails === true;
    const stylists = this.parseStylistNames(value.stylistsText);
    const employeeCalendarEnabled =
      serviceType === 'friseur' && value.planTier === 'pro' && value.calendarMode === 'employee';
    const employees = employeeCalendarEnabled
      ? this.employeeSettings
          .map((employee) => ({
            ...employee,
            name: employee.name.trim(),
            hours: employee.hours.trim() || value.hours || 'Mo–Fr 09:00–18:00',
            breakHours: employee.breakHours?.trim() || undefined,
          }))
          .filter((employee) => employee.name.length > 0)
      : [];
    const salonServices =
      serviceType === 'friseur'
        ? this.salonServiceSettings.map((service) => ({
            ...service,
            label: service.label.trim(),
          }))
        : [];
    if (serviceType === 'friseur' && salonServices.some((service) => !service.label)) {
      this.formError = 'Bitte für jede ausgewählte Leistung einen Namen eintragen.';
      return;
    }
    if (employeeCalendarEnabled && employees.length === 0) {
      this.formError = 'Bitte mindestens einen Mitarbeiter für den Mitarbeiterkalender anlegen.';
      return;
    }
    const serviceNames = salonServices.map((service) => service.label.toLocaleLowerCase('de'));
    if (serviceType === 'friseur' && new Set(serviceNames).size !== serviceNames.length) {
      this.formError = 'Jeder Service darf nur einmal vorkommen.';
      return;
    }
    if (
      serviceType === 'friseur' &&
      value.showServicePrices === true &&
      salonServices.some((service) => service.price === undefined)
    ) {
      this.formError = 'Bitte für jede ausgewählte Leistung einen Preis eintragen.';
      return;
    }
    const payload = {
      name: value.name || 'Neues Unternehmen',
      address: value.address || 'Beispielstraße 12, 12345 Musterstadt',
      hours: value.hours || 'Mo–So 12:00–20:00',
      breakHours: value.breakHours || undefined,
      email: value.email || 'kontakt@example.com',
      splitServiceEmails,
      womenServicesEmail: splitServiceEmails
        ? value.womenServicesEmail?.trim() || undefined
        : undefined,
      serviceType,
      bookingMode: (value.bookingMode || 'confirm') as 'confirm' | 'request',
      planTier: (value.planTier || 'starter') as 'starter' | 'pro',
      calendarMode: (employeeCalendarEnabled ? 'employee' : 'shared') as CalendarMode,
      employees,
      seatingOptionsEnabled: serviceType === 'restaurant' && value.seatingOptionsEnabled === true,
      stylistSelectionEnabled:
        serviceType === 'friseur' &&
        ((employeeCalendarEnabled && employees.length > 0) ||
          (value.stylistSelectionEnabled === true && stylists.length > 0)),
      stylists:
        serviceType === 'friseur'
          ? employeeCalendarEnabled
            ? employees.map((employee) => employee.name)
            : stylists
          : [],
      salonServices,
      showServicePrices: serviceType === 'friseur' && value.showServicePrices === true,
      loginPin: value.loginPin?.trim() || undefined,
      slotCapacity: Number(value.slotCapacity || 3),
      slotIntervalMinutes: Number(value.slotIntervalMinutes || 45) as 30 | 45 | 60,
      bookingBufferMinutes: Number(value.bookingBufferMinutes ?? 120),
      timeSelectionMode: (value.timeSelectionMode || 'slots') as TimeSelectionMode,
      logoUrl: value.logoUrl?.trim() || undefined,
      brandColor: value.brandColor || '#4f46e5',
      profile: value.profile,
    };

    let request$;
    try {
      request$ = this.editingSlug
        ? this.companyService.updateCompany(this.editingSlug, payload)
        : this.companyService.createCompany(payload);
    } catch {
      this.formError = 'Die Änderungen konnten nicht lokal gespeichert werden. Bitte weniger oder kleinere Fotos verwenden.';
      return;
    }
    this.isSaving = true;
    request$.subscribe({
      next: (company) => {
        this.isSaving = false;
        if (payload.profile && !company.profile) {
          this.formError = 'Die Profilinhalte wurden nicht übernommen. Bitte die Profil-Erweiterung der API und Datenbank bereitstellen.';
          return;
        }
        if (
          employeeCalendarEnabled &&
          (company.calendarMode !== 'employee' || (company.employees?.length || 0) === 0)
        ) {
          this.formError =
            'Der Mitarbeiterkalender konnte nicht gespeichert werden. Bitte die Supabase-Spalten prüfen.';
          return;
        }
        if (this.standaloneEditSlug) {
          this.editingSlug = company.slug;
          if (company.profile) this.companyForm.controls.profile.setValue(company.profile, { emitEvent: false });
          this.companyForm.markAsPristine();
          this.formSuccess = 'Alle Änderungen wurden gespeichert.';
          if (company.slug !== this.standaloneEditSlug) {
            this.router.navigate(['/admin/unternehmen', company.slug], { replaceUrl: true });
          }
          return;
        }
        this.router.navigate(['/admin']);
      },
      error: (error) => {
        this.isSaving = false;
        this.formError =
          error?.error?.error ||
          'Speichern fehlgeschlagen. Bitte Supabase-Spalten prüfen und erneut versuchen.';
      },
    });
  }

  startEdit(company: Company): void {
    this.editingSlug = company.slug;
    this.companyForm.patchValue({
      profile: company.profile || defaultCompanyProfile(company.serviceType),
      name: company.name,
      address: company.address,
      hours: company.hours,
      breakHours: company.breakHours || '',
      email: company.email,
      splitServiceEmails: company.splitServiceEmails || false,
      womenServicesEmail: company.womenServicesEmail || '',
      serviceType: company.serviceType || 'restaurant',
      bookingMode: company.bookingMode || 'confirm',
      planTier: company.planTier || 'starter',
      calendarMode: company.calendarMode || 'shared',
      seatingOptionsEnabled: company.seatingOptionsEnabled || false,
      stylistSelectionEnabled: company.stylistSelectionEnabled || false,
      stylistsText: (company.stylists || []).join('\n'),
      showServicePrices: company.showServicePrices || false,
      loginPin: '',
      slotCapacity: company.slotCapacity ?? 3,
      slotIntervalMinutes: company.slotIntervalMinutes ?? 45,
      bookingBufferMinutes: company.bookingBufferMinutes ?? 120,
      timeSelectionMode: company.timeSelectionMode || 'slots',
      logoUrl: company.logoUrl || '',
      brandColor: company.brandColor || '#4f46e5',
    });
    this.configureSalonServiceSettings(company.salonServices);
    this.employeeSettings = (company.employees || []).map((employee) => ({ ...employee }));
    if (
      this.employeeSettings.length === 0 &&
      company.calendarMode === 'employee' &&
      (company.stylists || []).length > 0
    ) {
      this.employeeSettings = (company.stylists || []).map((name, index) =>
        this.createEmployee(name, index),
      );
    }
    this.updateWomenServicesEmailValidators();
  }

  cancelEdit(): void {
    this.router.navigate(['/admin']);
  }

  scrollToSection(sectionId: string): void {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  formatBookingBufferMinutes(value: number | undefined): string {
    const minutes = Number(value ?? 120);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return 'Sofort';
    }
    if (minutes % 60 === 0) {
      const hours = minutes / 60;
      return hours === 1 ? '1 Stunde' : `${hours} Stunden`;
    }
    return `${minutes} Minuten`;
  }

  deleteCompany(slug: string): void {
    const confirmed = window.confirm('Unternehmen wirklich löschen?');
    if (!confirmed) {
      return;
    }
    this.companyService.deleteCompany(slug).subscribe({
      next: () => this.loadCompanies(),
    });
  }

  private loadCompanies(): void {
    if (this.isCreatingCompany) return;
    this.isLoadingCompanies = true;
    this.companyListError = '';
    if (this.standaloneEditSlug) {
      this.formError = '';
      this.companyService.getCompany(this.standaloneEditSlug).subscribe({
        next: company => {
          this.isLoadingCompanies = false;
          if (company) this.startEdit(company);
          else this.formError = 'Das Unternehmen wurde nicht gefunden.';
        },
        error: () => {
          this.isLoadingCompanies = false;
          this.formError = 'Das Unternehmen konnte nicht geladen werden.';
        },
      });
      return;
    }
    this.companyService.listCompanies().subscribe({
      next: (companies) => {
        this.companies = companies;
        this.isLoadingCompanies = false;
      },
      error: () => {
        this.isLoadingCompanies = false;
        this.companyListError = 'Die Unternehmen konnten nicht geladen werden. Bitte versuche es erneut.';
      },
    });
  }

  private resetForm(): void {
    this.editingSlug = null;
    this.formError = '';
    this.formSuccess = '';
    this.companyForm.reset({
      profile: defaultCompanyProfile('restaurant'),
      name: '',
      address: 'Beispielstraße 12, 12345 Musterstadt',
      hours: 'Mo–So 12:00–20:00',
      breakHours: '',
      email: 'kontakt@example.com',
      splitServiceEmails: false,
      womenServicesEmail: '',
      serviceType: 'restaurant',
      bookingMode: 'confirm',
      planTier: 'starter',
      calendarMode: 'shared',
      seatingOptionsEnabled: false,
      stylistSelectionEnabled: false,
      stylistsText: '',
      showServicePrices: false,
      loginPin: this.createRandomPin(),
      slotCapacity: 3,
      slotIntervalMinutes: 45,
      bookingBufferMinutes: 120,
      timeSelectionMode: 'slots',
      logoUrl: '',
      brandColor: '#4f46e5',
    });
    this.salonServiceSettings = this.createDefaultSalonServiceSettings();
    this.employeeSettings = [];
    this.logoError = '';
    this.updateWomenServicesEmailValidators();
    this.companyForm.markAsPristine();
  }

  generateLoginPin(): void {
    this.companyForm.patchValue({ loginPin: this.createRandomPin() });
    this.companyForm.markAsDirty();
  }

  updateSalonServicePrice(service: SalonServiceSetting, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const price = Number(value);
    service.price =
      value !== '' && Number.isFinite(price) && price >= 0
        ? Math.round(Math.min(price, 10000) * 100) / 100
        : undefined;
    this.companyForm.markAsDirty();
  }

  addSalonService(): void {
    if (this.salonServiceSettings.length >= 100) {
      this.formError = 'Es können maximal 100 Leistungen angelegt werden.';
      return;
    }
    this.salonServiceSettings.push({
      value: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      label: '',
      audience: 'general',
      durationMinutes: 45,
    });
    this.companyForm.markAsDirty();
  }

  removeSalonService(service: SalonServiceSetting): void {
    this.salonServiceSettings = this.salonServiceSettings.filter((item) => item !== service);
    this.companyForm.markAsDirty();
  }

  updateSalonServiceLabel(service: SalonServiceSetting, event: Event): void {
    service.label = (event.target as HTMLInputElement).value.slice(0, 120);
    this.companyForm.markAsDirty();
  }

  updateSalonServiceAudience(service: SalonServiceSetting, event: Event): void {
    const audience = (event.target as HTMLSelectElement).value;
    service.audience =
      audience === 'men' || audience === 'women' ? audience : ('general' as SalonServiceAudience);
    this.companyForm.markAsDirty();
  }

  updateSalonServiceDuration(service: SalonServiceSetting, event: Event): void {
    const duration = Number((event.target as HTMLSelectElement).value);
    service.durationMinutes = Number.isFinite(duration) ? duration : 45;
    this.companyForm.markAsDirty();
  }

  addEmployee(): void {
    if (this.employeeSettings.length >= 30) {
      this.formError = 'Es können maximal 30 Mitarbeiter angelegt werden.';
      return;
    }
    this.employeeSettings.push(this.createEmployee('', this.employeeSettings.length));
    this.companyForm.markAsDirty();
  }

  removeEmployee(employee: CompanyEmployee): void {
    this.employeeSettings = this.employeeSettings.filter((item) => item !== employee);
    this.companyForm.markAsDirty();
  }

  updateEmployee(
    employee: CompanyEmployee,
    field: 'name' | 'hours' | 'breakHours' | 'color',
    event: Event,
  ): void {
    employee[field] = (event.target as HTMLInputElement).value;
    this.companyForm.markAsDirty();
  }

  toggleEmployeeService(employee: CompanyEmployee, serviceValue: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const currentValues =
      employee.serviceValues.length === 0
        ? this.salonServiceSettings.map((service) => service.value)
        : employee.serviceValues;
    employee.serviceValues = checked
      ? Array.from(new Set([...currentValues, serviceValue]))
      : currentValues.filter((value) => value !== serviceValue);
    this.companyForm.markAsDirty();
  }

  employeeOffersService(employee: CompanyEmployee, serviceValue: string): boolean {
    return employee.serviceValues.length === 0 || employee.serviceValues.includes(serviceValue);
  }

  get employeeCalendarAvailable(): boolean {
    return (
      this.companyForm.value.serviceType === 'friseur' && this.companyForm.value.planTier === 'pro'
    );
  }

  get employeeCalendarEnabled(): boolean {
    return this.employeeCalendarAvailable && this.companyForm.value.calendarMode === 'employee';
  }

  get customerPageLink(): string[] {
    return this.companyPageLink({ slug: this.editingSlug || '', serviceType: this.companyForm.value.serviceType === 'friseur' ? 'friseur' : 'restaurant' });
  }

  companyPageLink(company: Pick<Company, 'slug' | 'serviceType'>): string[] {
    const local = isDevMode() && typeof window !== 'undefined' && window.location.hostname === 'localhost';
    return local
      ? ['/vorschau', company.serviceType === 'friseur' ? 'salon' : 'restaurant', company.slug]
      : ['/', company.slug];
  }

  get logoPreview(): string {
    return this.companyForm.value.logoUrl?.trim() || '';
  }

  get companyInitials(): string {
    const name = this.companyForm.value.name?.trim() || 'Unternehmen';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  get brandPreviewColor(): string {
    const color = this.companyForm.value.brandColor || '';
    return /^#[0-9a-f]{6}$/i.test(color) ? color : '#4f46e5';
  }

  async onLogoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.logoError = '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.logoError = 'Bitte ein PNG-, JPG- oder WebP-Bild auswählen.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.logoError = 'Das Logo darf maximal 5 MB groß sein.';
      return;
    }

    this.isProcessingLogo = true;
    try {
      const logoUrl = await this.compressLogo(file);
      this.companyForm.patchValue({ logoUrl });
      this.companyForm.markAsDirty();
    } catch {
      this.logoError = 'Das Logo konnte nicht verarbeitet werden. Bitte ein anderes Bild wählen.';
    } finally {
      this.isProcessingLogo = false;
    }
  }

  removeLogo(): void {
    this.companyForm.patchValue({ logoUrl: '' });
    this.companyForm.markAsDirty();
    this.logoError = '';
  }

  private compressLogo(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const maxDimension = 320;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas unavailable'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        const compressed = canvas.toDataURL('image/webp', 0.86);
        if (compressed.length > 500_000) {
          reject(new Error('Compressed logo is too large'));
          return;
        }
        resolve(compressed);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Invalid image'));
      };
      image.src = objectUrl;
    });
  }

  private createRandomPin(): string {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
  }

  private parseStylistNames(value: unknown): string[] {
    return Array.from(
      new Set(
        String(value || '')
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    );
  }

  private updateWomenServicesEmailValidators(): void {
    const control = this.companyForm.get('womenServicesEmail');
    if (!control) {
      return;
    }
    const splitServiceEmails =
      this.companyForm.value.serviceType === 'friseur' &&
      this.companyForm.value.splitServiceEmails === true;
    if (splitServiceEmails) {
      control.setValidators([Validators.required, Validators.email]);
    } else {
      control.clearValidators();
      control.setErrors(null);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  private createDefaultSalonServiceSettings(): SalonServiceSetting[] {
    return [];
  }

  private configureSalonServiceSettings(services: SalonServiceOption[] | undefined): void {
    this.salonServiceSettings = (services || []).map((service) => ({
      ...service,
      durationMinutes: service.durationMinutes || 45,
    }));
  }

  private createEmployee(name: string, index: number): CompanyEmployee {
    const colors = ['#4f46e5', '#0f8f82', '#d97706', '#db2777', '#2563eb'];
    return {
      id: `employee-${Date.now().toString(36)}-${index + 1}`,
      name,
      color: colors[index % colors.length],
      hours: this.companyForm.value.hours || 'Mo–Fr 09:00–18:00',
      breakHours: this.companyForm.value.breakHours || undefined,
      serviceValues: [],
    };
  }
}
