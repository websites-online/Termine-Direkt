export type SalonServiceAudience = 'men' | 'women' | 'general';

export type SalonServiceOption = {
  value: string;
  label: string;
  audience: SalonServiceAudience;
};

export const SALON_SERVICES: SalonServiceOption[] = [
  { value: 'herrenhaarschnitt', label: 'Herrenhaarschnitt', audience: 'men' },
  { value: 'fade_cut', label: 'Fade Cut', audience: 'men' },
  { value: 'skin_fade', label: 'Skin Fade', audience: 'men' },
  { value: 'maschinenschnitt', label: 'Maschinenschnitt', audience: 'men' },
  { value: 'haarschnitt_bart', label: 'Haarschnitt und Bart', audience: 'men' },
  { value: 'bart_trimmen_formen', label: 'Bart trimmen / formen', audience: 'men' },
  { value: 'kinderhaarschnitt_jungen', label: 'Kinderhaarschnitt Jungen', audience: 'men' },
  { value: 'damenhaarschnitt', label: 'Damenhaarschnitt', audience: 'women' },
  {
    value: 'waschen_schneiden_foehnen_frauen',
    label: 'Waschen, Schneiden & Föhnen (Frauen)',
    audience: 'women'
  },
  { value: 'waschen_foehnen_frauen', label: 'Waschen & Föhnen (Frauen)', audience: 'women' },
  {
    value: 'faerben_schneiden_frauen',
    label: 'Färben und Schneiden (Frauen)',
    audience: 'women'
  },
  { value: 'ansatzfarbe_frauen', label: 'Ansatzfarbe (Frauen)', audience: 'women' },
  { value: 'balayage_frauen', label: 'Balayage (Frauen)', audience: 'women' },
  { value: 'straehnen_highlights_frauen', label: 'Strähnen / Highlights (Frauen)', audience: 'women' },
  { value: 'sonstiges', label: 'Sonstiges', audience: 'general' }
];
