import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input, OnDestroy } from '@angular/core';
import { AbstractControl, ControlValueAccessor, FormBuilder, NG_VALIDATORS, NG_VALUE_ACCESSOR, ReactiveFormsModule, ValidationErrors, Validator, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CompanyProfile, defaultCompanyProfile, normalizeCompanyProfile, ProfileMenuItem, ProfilePhoto } from '../../shared/company-profile';
import { SalonServiceOption } from '../../shared/salon-services';

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
  @Input() services: SalonServiceOption[] = [];
  value: CompanyProfile = defaultCompanyProfile('restaurant');
  disabled = false;
  uploading = false;
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
    return this.form.invalid || this.menuInvalid || this.uploading ? { companyProfile: true } : null;
  }
  get menuInvalid(): boolean {
    return this.serviceType === 'restaurant' && this.value.menu.some(item => !item.name.trim() ||
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
    this.value = { ...this.value, photos: defaultCompanyProfile(this.serviceType).photos };
    this.publish();
  }
  async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    this.error = '';
    if (files.length + this.value.photos.length > 6) { this.error = 'Es sind maximal 6 Fotos möglich.'; return; }
    if (files.some(file => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      this.error = 'Bitte JPG, PNG oder WebP mit höchstens 5 MB pro Bild auswählen.'; return;
    }
    this.uploading = true;
    this.validatorChanged();
    try {
      const photos: ProfilePhoto[] = [];
      for (const file of files) photos.push({ src: await this.compress(file), title: '', alt: file.name.replace(/\.[^.]+$/, '') });
      this.value = { ...this.value, photos: [...this.value.photos, ...photos] };
      this.publish();
    } catch { this.error = 'Das Bild konnte nicht verarbeitet werden. Bitte ein anderes Foto wählen.'; }
    finally { this.uploading = false; this.validatorChanged(); }
  }
  private compress(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) { URL.revokeObjectURL(url); reject(new Error('Canvas')); return; }
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        let image = '';
        for (const quality of [.82, .68, .5, .35]) {
          image = canvas.toDataURL('image/webp', quality);
          if (image.length <= 180_000) { resolve(image); return; }
        }
        reject(new Error('Image too large'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image')); };
      img.src = url;
    });
  }
  addDish(): void {
    if (this.value.menu.length >= 60) return;
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
  dishText(item: ProfileMenuItem, field: 'name' | 'description' | 'category', event: Event): void {
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
  ngOnDestroy(): void { this.subscription.unsubscribe(); }
}
