import { prepareCompanyImage } from './company-image-upload';
import { normalizeCompanyProfile, PROFILE_IMAGE_MAX_LENGTH } from './company-profile';

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
  const profileOptions = { maxDimension: 1200, maxLength: PROFILE_IMAGE_MAX_LENGTH };
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
    expect(detailedPhoto.toDataURL('image/webp', .35).length).toBeGreaterThan(PROFILE_IMAGE_MAX_LENGTH);
    const src = await prepareCompanyImage(photoFile, profileOptions);
    expect(src.length).toBeLessThanOrEqual(PROFILE_IMAGE_MAX_LENGTH);
    const image = await decode(src);
    expect(image.naturalWidth).toBeLessThan(1200);
    expect(image.naturalWidth / image.naturalHeight).toBeCloseTo(1.5, 1);
    expect(normalizeCompanyProfile({ photos: [{ src }] }).photos[0].src).toBe(src);
  }, 15_000);

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
