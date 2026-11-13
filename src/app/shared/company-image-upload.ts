const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_ERROR = 'Das Bild konnte nicht gelesen werden. Bitte als JPG, PNG oder WebP erneut exportieren.';

export class CompanyImageUploadError extends Error {}

/** Decode locally and keep shrinking until the image fits the stored profile. */
export async function prepareCompanyImage(
  file: File,
  options: { maxDimension: number; maxLength: number },
): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new CompanyImageUploadError('Das Bild darf maximal 5 MB groß sein.');
  }
  const type = file.type.toLowerCase();
  if (['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'].includes(type) ||
      /\.(heic|heif)$/i.test(file.name)) {
    throw new CompanyImageUploadError('HEIC/HEIF wird hier nicht unterstützt. Bitte das Foto als JPG oder PNG exportieren und erneut auswählen.');
  }
  const supportedType = ['image/png', 'image/x-png', 'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/webp'].includes(type);
  const missingType = !type || type === 'application/octet-stream';
  if (!supportedType && !(missingType && /\.(jpe?g|png|webp)$/i.test(file.name))) {
    throw new CompanyImageUploadError('Bitte ein JPG-, PNG- oder WebP-Bild auswählen.');
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new CompanyImageUploadError(IMAGE_ERROR));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new CompanyImageUploadError(IMAGE_ERROR);

    const scale = Math.min(1, options.maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    let width = Math.max(1, Math.round(image.naturalWidth * scale));
    let height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new CompanyImageUploadError('Die Bildverarbeitung ist in diesem Browser nicht verfügbar. Bitte einen anderen Browser verwenden.');

    while (true) {
      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);
      let smallestLength = Infinity;
      for (const quality of [.86, .72, .56, .4]) {
        const result = canvas.toDataURL('image/webp', quality);
        if (/^data:image\/(?:png|jpeg|webp);base64,/.test(result) && result.length <= options.maxLength) return result;
        smallestLength = Math.min(smallestLength, result.length);
        // Browsers without a WebP encoder return PNG, which ignores quality.
        if (result.startsWith('data:image/png;')) break;
      }
      const dimension = Math.max(width, height);
      if (dimension <= 160) break;
      const nextScale = Math.min(.75, Math.sqrt(options.maxLength / smallestLength) * .9);
      const reduction = Math.max(160, Math.floor(dimension * nextScale)) / dimension;
      width = Math.max(1, Math.floor(width * reduction));
      height = Math.max(1, Math.floor(height * reduction));
    }
    throw new CompanyImageUploadError('Das Bild konnte nicht ausreichend verkleinert werden. Bitte einen kleineren Bildausschnitt auswählen.');
  } catch (error) {
    if (error instanceof CompanyImageUploadError) throw error;
    throw new CompanyImageUploadError('Das Bild konnte nicht verarbeitet werden. Bitte als JPG, PNG oder WebP erneut exportieren.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
