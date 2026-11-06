import type { Company } from '../services/company-api.service';
import { CompanyProfile, defaultCompanyProfile } from './company-profile';

export function exampleCompanyProfile(type: 'friseur' | 'restaurant'): CompanyProfile {
  return {
    ...defaultCompanyProfile(type),
    photos: type === 'restaurant' ? [
      { src: '/media/profile-preview/restaurant-interior.jpg', title: 'Ein Platz zum Genießen', alt: 'Beispielbild: gemütliches italienisches Restaurant' },
      { src: '/media/profile-preview/restaurant-food.jpg', title: 'Mit Liebe gekocht', alt: 'Beispielbild: frische Pasta mit Tomaten und Basilikum' },
    ] : [
      { src: '/media/profile-preview/salon-hero.jpg', title: 'Ein Ort zum Ankommen', alt: 'Beispielbild: heller Salon mit Naturmaterialien' },
      { src: '/media/profile-preview/salon-detail.jpg', title: 'Dein Platz für eine kleine Auszeit', alt: 'Beispielbild: moderner Friseursalon' },
      { src: '/media/profile-preview/hair-story.jpg', title: 'Mit Liebe zum Handwerk', alt: 'Beispielbild: persönliches Hairstyling im Salon' },
    ],
  };
}

// Local examples only. Never inserted into the production database.
export function atelierProfileExample(): Company {
  return {
    id: 'local-atelier7-preview', slug: 'atelier7', name: 'Atelier7',
    address: 'Bergmannstraße 12, 90429 Nürnberg', hours: 'Di–Fr 10:00–19:00; Sa 09:00–16:00',
    email: 'atelier7-preview@example.test', loginPin: '123456', serviceType: 'friseur',
    bookingMode: 'request', timeSelectionMode: 'free', slotCapacity: 1, slotIntervalMinutes: 30,
    bookingBufferMinutes: 120, showServicePrices: false, brandColor: '#4f46e5',
    logoUrl: '/media/examples/atelier7.jpg', stylistSelectionEnabled: true,
    stylists: ['Mara', 'Alex', 'Nila'], planTier: 'pro', calendarMode: 'shared',
    salonServices: [
      { value: 'herrenhaarschnitt', label: 'Signature Cut', audience: 'men', durationMinutes: 45 },
      { value: 'damenhaarschnitt', label: 'Cut & Styling', audience: 'women', durationMinutes: 60 },
      { value: 'balayage_frauen', label: 'Balayage & Gloss', audience: 'women', durationMinutes: 150 },
      { value: 'waschen_foehnen_frauen', label: 'Wash & Blow Dry', audience: 'women', durationMinutes: 45 },
      { value: 'kinderhaarschnitt_jungen', label: 'Little Ones Cut', audience: 'general', durationMinutes: 30 },
      { value: 'sonstiges', label: 'Zeit für eine Beratung', audience: 'general', durationMinutes: 20 },
    ],
    profile: {
      ...exampleCompanyProfile('friseur'), aboutTitle: 'Hi, ich bin Arsel.',
      aboutText: 'Ich freue mich, dich bei Atelier7 begrüßen zu dürfen. Ob frischer Schnitt oder ein neuer Look – ich nehme mir Zeit für dich. Deinen Besuch im Salon oder unseren mobilen Service kannst du ganz unkompliziert anfragen.',
      offeringsIntro: 'Von einer kleinen Veränderung bis zum neuen Lieblingslook.',
    },
  };
}

export function restaurantProfileExample(): Company {
  return {
    id: 'local-restaurant-profile', slug: 'osteria-demo', name: 'Osteria Bella Sera',
    address: 'Gartenstraße 8, 90403 Nürnberg', hours: 'Di–So 12:00–23:00',
    email: 'restaurant-preview@example.test', loginPin: '123456', serviceType: 'restaurant',
    bookingMode: 'confirm', timeSelectionMode: 'free', slotCapacity: 3, slotIntervalMinutes: 30,
    bookingBufferMinutes: 120, seatingOptionsEnabled: true, brandColor: '#a65d38',
    planTier: 'pro', calendarMode: 'shared',
    profile: {
      ...exampleCompanyProfile('restaurant'), aboutTitle: 'Benvenuti bei uns.',
      aboutText: 'Wir sind ein kleines Team mit einer großen Liebe zur italienischen Küche. Bei uns gibt es hausgemachte Pasta, frische Zutaten und Zeit für einen entspannten Abend. Wir freuen uns auf deinen Besuch.',
      offeringsIntro: 'Hausgemacht, saisonal und mit viel Liebe zubereitet. Eine kleine Auswahl aus unserer Küche.',
      menu: [
        { id: 'burrata', name: 'Burrata', description: 'Mit bunten Tomaten, Basilikum und geröstetem Brot.', category: 'Antipasti', price: 12.5 },
        { id: 'bruschetta', name: 'Bruschetta', description: 'Knuspriges Brot, sonnengereifte Tomaten und Olivenöl.', category: 'Antipasti', price: 7.5 },
        { id: 'pasta', name: 'Pappardelle al Pomodoro', description: 'Hausgemachte Pasta mit Kirschtomaten, Basilikum und Parmesan.', category: 'Pasta', price: 16.5 },
        { id: 'ravioli', name: 'Ravioli Ricotta e Spinaci', description: 'Mit brauner Butter und frischem Salbei.', category: 'Pasta', price: 18 },
        { id: 'tiramisu', name: 'Tiramisù', description: 'Unser Klassiker mit Espresso und Mascarpone.', category: 'Dolci', price: 7.5 },
      ],
    },
  };
}
