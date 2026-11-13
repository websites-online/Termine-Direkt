import { CommonModule } from '@angular/common';
import { Component, EventEmitter, forwardRef, inject, Input, OnDestroy, Output } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AbstractControl, ControlValueAccessor, FormBuilder, NG_VALIDATORS, NG_VALUE_ACCESSOR, ReactiveFormsModule, ValidationErrors, Validator, Validators } from '@angular/forms';
import { firstValueFrom, Subscription } from 'rxjs';
import { CompanyProfile, defaultCompanyProfile, MAX_PROFILE_MENU_ITEMS, normalizeCompanyProfile, PROFILE_IMAGE_MAX_LENGTH, ProfileMenuItem, ProfilePhoto } from '../../shared/company-profile';
import { CompanyImageUploadError, prepareCompanyImage } from '../../shared/company-image-upload';
import { SalonServiceOption } from '../../shared/salon-services';
import { exampleCompanyProfile } from '../../shared/profile-preview-fixtures';

@Component({
  selector: 'app-company-profile-editor', standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './company-profile-editor.component.html',
  styleUrl: './company-profile-editor.component.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CompanyProfileEditorComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => CompanyProfileEditorComponent), multi: true },
  ],
})
export class CompanyProfileEditorComponent implements ControlValueAccessor, Validator, OnDestroy {
  @Input() serviceType = 'restaurant';
  @Input() companySlug = '';
  @Input() services: SalonServiceOption[] = [];
  private proEnabled = false;
  @Input() set proFeaturesEnabled(enabled: boolean) {
    this.proEnabled = enabled;
    this.validatorChanged();
  }
  get proFeaturesEnabled(): boolean { return this.proEnabled; }
  @Output() managePlan = new EventEmitter<void>();
  value: CompanyProfile = defaultCompanyProfile('restaurant');
  disabled = false;
  uploading = false;
  importingMenu = false;
  menuError = '';
  readonly maxMenuItems = MAX_PROFILE_MENU_ITEMS;
  private readonly http = inject(HttpClient);
  error = '';
  openDishId = '';
  private change: (value: CompanyProfile) => void = () => {};
  private touched: () => void = () => {};
  private validatorChanged: () => void = () => {};
  readonly form = new FormBuilder().nonNullable.group({
    welcomeTitle: ['', Validators.maxLength(80)],
    welcomeSubtitle: ['', Validators.maxLength(160)],
    aboutTitle: ['', Validators.maxLength(100)],
    aboutText: ['', Validators.maxLength(2400)],
    offeringsTitle: ['', Validators.maxLength(100)],
    offeringsIntro: ['', Validators.maxLength(600)],
    menuNotes: ['', Validators.maxLength(1600)],
  });
  private readonly subscription: Subscription = this.form.valueChanges.subscribe(() => this.publish());

  writeValue(profile: CompanyProfile | null): void {
    this.value = normalizeCompanyProfile(profile || defaultCompanyProfile(this.serviceType));
    this.form.patchValue(this.value, { emitEvent: false });
  }
  registerOnChange(fn: (value: CompanyProfile) => void): void { this.change = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  registerOnValidatorChange(fn: () => void): void { this.validatorChanged = fn; }
  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    disabled ? this.form.disable({ emitEvent: false }) : this.form.enable({ emitEvent: false });
  }
  validate(_control: AbstractControl): ValidationErrors | null {
    return this.form.invalid || this.menuInvalid || this.uploading || this.importingMenu ? { companyProfile: true } : null;
  }
  get menuInvalid(): boolean {
    return this.proFeaturesEnabled && this.serviceType === 'restaurant' && this.value.menu.some(item => !item.name.trim() ||
      (item.price !== undefined && (!Number.isFinite(item.price) || item.price < 0 || item.price > 10000)));
  }
  touch(): void { this.touched(); }
  publish(): void {
    this.value = { ...this.value, ...this.form.getRawValue() };
    this.change(this.value);
    this.validatorChanged();
  }
  photoText(photo: ProfilePhoto, field: 'title' | 'alt', event: Event): void {
    photo[field] = (event.target as HTMLInputElement).value;
    this.publish();
  }
  movePhoto(index: number, offset: number): void {
    const target = index + offset;
    if (target < 0 || target >= this.value.photos.length) return;
    const photos = [...this.value.photos];
    [photos[index], photos[target]] = [photos[target], photos[index]];
    this.value = { ...this.value, photos };
    this.publish();
  }
  removePhoto(index: number): void {
    this.value = { ...this.value, photos: this.value.photos.filter((_, i) => i !== index) };
    this.publish();
  }
  useExamplePhotos(): void {
    this.value = { ...this.value, photos: exampleCompanyProfile(this.serviceType === 'friseur' ? 'friseur' : 'restaurant').photos };
    this.publish();
  }
  async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    this.error = '';
    if (!files.length || this.uploading || this.disabled) return;
    if (files.length + this.value.photos.length > 6) { this.error = 'Es sind maximal 6 Fotos möglich.'; return; }
    this.uploading = true;
    this.validatorChanged();
    try {
      const photos: ProfilePhoto[] = [];
      for (const file of files) photos.push({
        src: await prepareCompanyImage(file, { maxDimension: 1200, maxLength: PROFILE_IMAGE_MAX_LENGTH }),
        title: '', alt: file.name.replace(/\.[^.]+$/, ''),
      });
      this.value = { ...this.value, photos: [...this.value.photos, ...photos] };
      this.publish();
    } catch (error) {
      this.error = error instanceof CompanyImageUploadError ? error.message : 'Das Bild konnte nicht verarbeitet werden. Bitte ein anderes Foto wählen.';
    }
    finally { this.uploading = false; this.validatorChanged(); }
  }
  addDish(): void {
    if (this.value.menu.length >= this.maxMenuItems) return;
    this.openDishId = crypto.randomUUID();
    this.value = { ...this.value, menu: [...this.value.menu, { id: this.openDishId, name: '', description: '', category: 'Speisen' }] };
    this.publish();
  }
  dishToggle(id: string, event: Event): void {
    if ((event.target as HTMLDetailsElement).open) this.openDishId = id;
    else if (this.openDishId === id) this.openDishId = '';
  }
  menuPrice(price: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price);
  }
  dishText(item: ProfileMenuItem, field: 'name' | 'description' | 'category' | 'priceLabel', event: Event): void {
    item[field] = (event.target as HTMLInputElement).value;
    this.publish();
  }
  dishPrice(item: ProfileMenuItem, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    item.price = value === '' ? undefined : Number(value);
    this.publish();
  }
  removeDish(index: number): void {
    this.value = { ...this.value, menu: this.value.menu.filter((_, i) => i !== index) };
    this.publish();
  }
  serviceDescription(key: string, event: Event): void {
    this.value = { ...this.value, serviceDescriptions: { ...this.value.serviceDescriptions, [key]: (event.target as HTMLTextAreaElement).value } };
    this.publish();
  }
  get hasPreparedMenu(): boolean {
    return this.companySlug === 'osteria-da-michele' && this.serviceType === 'restaurant' && !this.value.menu.length;
  }
  async importPreparedMenu(): Promise<void> {
    if (!this.hasPreparedMenu || this.disabled || this.importingMenu) return;
    this.importingMenu = true;
    this.menuError = '';
    this.validatorChanged();
    try {
      const data = await firstValueFrom(this.http.get<Record<string, unknown>>('/menus/osteria-da-michele.json'));
      if (data['companySlug'] !== this.companySlug || !Array.isArray(data['menu']) ||
          !data['menu'].length || data['menu'].length > this.maxMenuItems) throw new Error('Invalid menu');
      const profile = normalizeCompanyProfile({
        ...this.value,
        menu: data['menu'], menuNotes: data['menuNotes'], menuDocumentUrl: data['menuDocumentUrl'],
        offeringsTitle: data['offeringsTitle'], offeringsIntro: data['offeringsIntro'],
      });
      if (profile.menu.length !== data['menu'].length) throw new Error('Incomplete menu');
      this.value = profile;
      this.form.patchValue(profile, { emitEvent: false });
      this.publish();
      this.touched();
    } catch {
      this.menuError = 'Die vorbereitete Speisekarte konnte nicht geladen werden. Bitte erneut versuchen.';
    } finally {
      this.importingMenu = false;
      this.validatorChanged();
    }
  }
  ngOnDestroy(): void { this.subscription.unsubscribe(); }
}
