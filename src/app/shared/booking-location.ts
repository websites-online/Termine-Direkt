export type BookingLocation = 'salon' | 'home';

export interface HomeVisitAddress {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  details?: string;
}

// Atelier7 offers both salon appointments and home visits, always by request.
export const hasMobileService = (slug: unknown, serviceType: unknown): boolean =>
  slug === 'atelier7' && serviceType === 'friseur';

export const normalizeHomeVisitAddress = (value: unknown): HomeVisitAddress | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const read = (key: string): string =>
    typeof record[key] === 'string' ? record[key].replace(/[|\r\n]+/g, ' ').trim() : '';
  const street = read('street');
  const houseNumber = read('houseNumber');
  const postalCode = read('postalCode');
  const city = read('city');
  const details = read('details');
  if (
    !street || street.length > 120 ||
    !houseNumber || houseNumber.length > 20 ||
    !/^\d{5}$/.test(postalCode) ||
    !city || city.length > 100 ||
    details.length > 300
  ) {
    return null;
  }
  return { street, houseNumber, postalCode, city, ...(details ? { details } : {}) };
};

export const formatHomeVisitAddress = (address: HomeVisitAddress): string =>
  `${address.street} ${address.houseNumber}, ${address.postalCode} ${address.city}`;

export const bookingLocationNoteParts = (
  location: BookingLocation,
  address?: HomeVisitAddress | null,
): string[] => [
  `Buchungsort: ${location === 'home' ? 'Hausbesuch' : 'Im Salon'}`,
  ...(location === 'home' && address
    ? [
        `Adresse: ${formatHomeVisitAddress(address)}`,
        ...(address.details ? [`Hinweise zum Hausbesuch: ${address.details}`] : []),
      ]
    : []),
];

export const extractBookingLocation = (note: string | null | undefined): {
  bookingLocation?: BookingLocation;
  visitAddress?: string;
  visitDetails?: string;
} => {
  const read = (key: string): string | undefined =>
    note?.split('|').map((part) => part.trim())
      .find((part) => part.startsWith(`${key}: `))?.slice(key.length + 2).trim() || undefined;
  const location = read('Buchungsort');
  if (location !== 'Hausbesuch' && location !== 'Im Salon') {
    return {};
  }
  return {
    bookingLocation: location === 'Hausbesuch' ? 'home' : 'salon',
    ...(location === 'Hausbesuch'
      ? { visitAddress: read('Adresse'), visitDetails: read('Hinweise zum Hausbesuch') }
      : {}),
  };
};
