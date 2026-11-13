import { prepareCompanyImage } from './company-image-upload';
import { normalizeCompanyProfile, PROFILE_IMAGE_MAX_DIMENSION, PROFILE_IMAGE_MAX_LENGTH } from './company-profile';

function canvas(width: number, height: number): HTMLCanvasElement {
  const result = document.createElement('canvas');
  result.width = width;
  result.height = height;
  return result;
}

function blob(image: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => image.toBlob(value => {
    if (value) resolve(value);
    else reject(new Error('Could not create test image'));
  }, type));
}

async function decode(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

describe('company image uploads in the browser', () => {
  const profileOptions = { maxDimension: PROFILE_IMAGE_MAX_DIMENSION, maxLength: PROFILE_IMAGE_MAX_LENGTH };
  let detailedPhoto: HTMLCanvasElement;
  let photoFile: File;

  beforeAll(async () => {
    detailedPhoto = canvas(1200, 800);
    const context = detailedPhoto.getContext('2d')!;
    const pixels = context.createImageData(1200, 800);
    let seed = 42;
    for (let i = 0; i < pixels.data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels.data[i] = i % 4 === 3 ? 255 : seed >>> 24;
    }
    context.putImageData(pixels, 0, 0);
    photoFile = new File([await blob(detailedPhoto)], 'detailreiches-foto.png', { type: 'image/png' });
  });

  it('accepts a photo below 5 MB that exceeded the old compression limit and survives normalization', async () => {
    expect(photoFile.size).toBeLessThan(5 * 1024 * 1024);
    expect(detailedPhoto.toDataURL('image/webp', .35).length).toBeGreaterThan(180_000);
    const src = await prepareCompanyImage(photoFile, profileOptions);
    expect(src.length).toBeLessThanOrEqual(PROFILE_IMAGE_MAX_LENGTH);
    const image = await decode(src);
    expect(image.naturalWidth).toBeLessThan(1200);
    expect(image.naturalWidth / image.naturalHeight).toBeCloseTo(1.5, 1);
    expect(normalizeCompanyProfile({ photos: [{ src }] }).photos[0].src).toBe(src);
  }, 15_000);

  it('keeps a detailed gallery photo at its original resolution with little pixel error', async () => {
    const response = await fetch('/media/profile-preview/restaurant-interior.jpg');
    expect(response.ok).toBeTrue();
    const file = new File([await response.blob()], 'restaurant.jpg', { type: 'image/jpeg' });
    const originalUrl = URL.createObjectURL(file);
    try {
      const original = await decode(originalUrl);
      const src = await prepareCompanyImage(file, profileOptions);
      const image = await decode(src);
      expect(image.naturalWidth).toBe(original.naturalWidth);
      expect(image.naturalHeight).toBe(original.naturalHeight);
      expect(src.length).toBeLessThanOrEqual(PROFILE_IMAGE_MAX_LENGTH);
      const output = canvas(original.naturalWidth, original.naturalHeight);
      const context = output.getContext('2d')!;
      context.drawImage(original, 0, 0);
      const before = context.getImageData(0, 0, output.width, output.height).data;
      context.clearRect(0, 0, output.width, output.height);
      context.drawImage(image, 0, 0);
      const after = context.getImageData(0, 0, output.width, output.height).data;
      let squaredError = 0;
      for (let i = 0; i < before.length; i++) {
        if (i % 4 !== 3) squaredError += (before[i] - after[i]) ** 2;
      }
      // RGB error stays below 8 levels out of 255, with no loss of resolution.
      expect(Math.sqrt(squaredError / (output.width * output.height * 3))).toBeLessThan(8);
      expect(normalizeCompanyProfile({ photos: [{ src }] }).photos[0].src).toBe(src);
    } finally {
      URL.revokeObjectURL(originalUrl);
    }
  });

  it('preserves the exact bytes of small originals instead of compressing them again', async () => {
    const original = canvas(640, 320);
    const context = original.getContext('2d')!;
    context.fillStyle = '#8351b7';
    context.fillRect(100, 100, 100, 100);
    const file = new File([await blob(original)], 'logo.png', { type: 'image/png' });
    const src = await prepareCompanyImage(file, { maxDimension: 640, maxLength: 500_000 });
    const result = await fetch(src);
    expect(await result.arrayBuffer()).toEqual(await file.arrayBuffer());
    expect((await decode(src)).naturalWidth).toBe(640);
  });

  it('limits large photos to the gallery resolution without changing their proportions', async () => {
    const original = canvas(3000, 2000);
    original.getContext('2d')!.fillRect(100, 100, 2000, 1200);
    const file = new File([await blob(original)], 'large-photo.png', { type: 'image/png' });
    const image = await decode(await prepareCompanyImage(file, profileOptions));
    expect(image.naturalWidth).toBe(2400);
    expect(image.naturalHeight).toBe(1600);
  });

  it('handles browsers that fall back to PNG encoding', async () => {
    const encode = HTMLCanvasElement.prototype.toDataURL;
    spyOn(HTMLCanvasElement.prototype, 'toDataURL').and.callFake(function (this: HTMLCanvasElement) {
      return encode.call(this, 'image/png');
    });
    const src = await prepareCompanyImage(photoFile, profileOptions);
    expect(src.startsWith('data:image/png;base64,')).toBeTrue();
    expect(src.length).toBeLessThanOrEqual(PROFILE_IMAGE_MAX_LENGTH);
    expect((await decode(src)).naturalWidth).toBeGreaterThan(0);
    expect(normalizeCompanyProfile({ photos: [{ src }] }).photos.length).toBe(1);
  });

  it('accepts supported filenames when the file picker supplies no usable MIME type', async () => {
    const bytes = await blob(canvas(16, 16), 'image/jpeg');
    for (const type of ['', 'application/octet-stream', 'image/jpg', 'image/pjpeg']) {
      const src = await prepareCompanyImage(new File([bytes], 'LOGO.JPG', { type }), profileOptions);
      expect((await decode(src)).naturalWidth).toBe(16);
    }
  });

  it('resizes logos while keeping their transparent background', async () => {
    const original = canvas(640, 320);
    original.getContext('2d')!.fillRect(200, 100, 100, 100);
    const file = new File([await blob(original)], 'logo.png', { type: 'image/png' });
    const src = await prepareCompanyImage(file, { maxDimension: 320, maxLength: 500_000 });
    const image = await decode(src);
    expect(image.naturalWidth).toBe(320);
    expect(image.naturalHeight).toBe(160);
    const output = canvas(320, 160);
    const context = output.getContext('2d')!;
    context.drawImage(image, 0, 0);
    expect(context.getImageData(0, 0, 1, 1).data[3]).toBe(0);
  });

  it('distinguishes oversized files and HEIC from processing errors', async () => {
    const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
    await expectAsync(prepareCompanyImage(large, profileOptions)).toBeRejectedWithError(/maximal 5 MB/);
    const heic = new File(['small'], 'photo.HEIC', { type: 'image/heic' });
    await expectAsync(prepareCompanyImage(heic, profileOptions)).toBeRejectedWithError(/HEIC\/HEIF.*JPG oder PNG/);
    const svg = new File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' });
    await expectAsync(prepareCompanyImage(svg, profileOptions)).toBeRejectedWithError(/JPG-, PNG- oder WebP/);
  });

  it('rejects corrupt images and releases their temporary URL', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL').and.callThrough();
    const file = new File(['not an image'], 'broken.jpg', { type: 'image/jpeg' });
    await expectAsync(prepareCompanyImage(file, profileOptions)).toBeRejectedWithError(/nicht gelesen/);
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it('reports canvas failures and releases their temporary URL', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL').and.callThrough();
    spyOn(HTMLCanvasElement.prototype, 'toDataURL').and.throwError('Encoder unavailable');
    await expectAsync(prepareCompanyImage(photoFile, profileOptions)).toBeRejectedWithError(/nicht verarbeitet/);
    expect(revoke).toHaveBeenCalledTimes(1);
  });
});
