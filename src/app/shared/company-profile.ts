export interface ProfilePhoto {
  src: string;
  title: string;
  alt: string;
}

export interface ProfileMenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price?: number;
}

export interface CompanyProfile {
  welcomeTitle: string;
  welcomeSubtitle: string;
  aboutTitle: string;
  aboutText: string;
  offeringsTitle: string;
  offeringsIntro: string;
  photos: ProfilePhoto[];
  menu: ProfileMenuItem[];
  serviceDescriptions: Record<string, string>;
}

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export function profileImageUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 180_000) return '';
  const url = text(value, 180_000);
  if (/^https:\/\//i.test(url) || /^\/media\/[a-z0-9/_\-.]+$/i.test(url) ||
      /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(url)) return url;
  return '';
}

/** Shared by the admin form, localhost persistence and the API. Plain text only. */
export function normalizeCompanyProfile(value: unknown): CompanyProfile {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const photos = Array.isArray(source['photos']) ? source['photos'].slice(0, 6) : [];
  const menu = Array.isArray(source['menu']) ? source['menu'].slice(0, 60) : [];
  const descriptions = source['serviceDescriptions'];
  const serviceDescriptions: Record<string, string> = {};
  if (descriptions && typeof descriptions === 'object' && !Array.isArray(descriptions)) {
    Object.entries(descriptions).slice(0, 100).forEach(([key, description]) => {
      if (/^[a-z0-9_]{1,80}$/.test(key) && key !== '__proto__') {
        serviceDescriptions[key] = text(description, 600);
      }
    });
  }
  return {
    welcomeTitle: text(source['welcomeTitle'], 80),
    welcomeSubtitle: text(source['welcomeSubtitle'], 160),
    aboutTitle: text(source['aboutTitle'], 100),
    aboutText: text(source['aboutText'], 2400),
    offeringsTitle: text(source['offeringsTitle'], 100),
    offeringsIntro: text(source['offeringsIntro'], 600),
    photos: photos.map(item => {
      const photo = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return { src: profileImageUrl(photo['src']), title: text(photo['title'], 100), alt: text(photo['alt'], 180) };
    }).filter(photo => Boolean(photo.src)),
    menu: menu.map((item, index) => {
      const dish = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const price = Number(dish['price']);
      return {
        id: text(dish['id'], 80).replace(/[^a-z0-9_-]/gi, '') || `dish-${index + 1}`,
        name: text(dish['name'], 120), description: text(dish['description'], 600),
        category: text(dish['category'], 60) || 'Speisen',
        ...(dish['price'] !== '' && dish['price'] !== null && dish['price'] !== undefined &&
          Number.isFinite(price) && price >= 0 && price <= 10000
          ? { price: Math.round(price * 100) / 100 } : {}),
      };
    }).filter(dish => Boolean(dish.name)),
    serviceDescriptions,
  };
}

export function defaultCompanyProfile(type: string | undefined): CompanyProfile {
  const restaurant = type !== 'friseur';
  return {
    welcomeTitle: 'Schön, dass du da bist.',
    welcomeSubtitle: restaurant ? 'Ein guter Abend beginnt hier.' : 'Dein Termin. Ganz entspannt.',
    aboutTitle: 'Über uns', aboutText: '',
    offeringsTitle: restaurant ? 'Unsere Speisekarte' : 'Unsere Leistungen',
    offeringsIntro: '', menu: [], serviceDescriptions: {},
    photos: restaurant ? [
      { src: '/media/profile-preview/restaurant-interior.jpg', title: 'Ein Platz zum Genießen', alt: 'Beispielbild: gemütliches italienisches Restaurant' },
      { src: '/media/profile-preview/restaurant-food.jpg', title: 'Mit Liebe gekocht', alt: 'Beispielbild: frische Pasta mit Tomaten und Basilikum' },
    ] : [
      { src: '/media/profile-preview/salon-hero.jpg', title: 'Ein Ort zum Ankommen', alt: 'Beispielbild: heller Salon mit Naturmaterialien' },
      { src: '/media/profile-preview/salon-detail.jpg', title: 'Dein Platz für eine kleine Auszeit', alt: 'Beispielbild: moderner Friseursalon' },
      { src: '/media/profile-preview/hair-story.jpg', title: 'Mit Liebe zum Handwerk', alt: 'Beispielbild: persönliches Hairstyling im Salon' },
    ],
  };
}
