# Unternehmensprofil und lokale Beispiele

Die öffentlichen URLs `/:slug` und `/r/:slug` laden diese Oberfläche. Die bestehenden
Kundenlinks bleiben erhalten. Unternehmensangaben stammen aus der Firmen-API;
die eingebettete `RestaurantPageComponent` verwendet die bisherigen Buchungsfelder,
Validatoren, Verfügbarkeitsabfragen und Versand-API. Statistikereignisse bleiben aktiv.
Nach erfolgreichem Absenden erscheint der Empfehlungshinweis mit 100-€-Gutschein.

Fotos, Über uns und Leistungen/Speisekarte gehören zu PRO. Ohne eigene Fotos ist
die Galerie ausgeblendet. Echte Unternehmen erhalten keine erfundenen Bilder,
Vorstellungen oder Speisen als Standard. Profilangaben lassen sich im Admin bearbeiten;
die Datenbank wird vor dem Rollout mit `supabase-profile-rollout.sql` vorbereitet.

Zusätzliche lokale Beispiele: `/vorschau/salon/atelier7` und
`/vorschau/restaurant/osteria-demo`. Nur diese im Entwicklungsmodus auf localhost
erreichbaren Routen setzen `localProfilePreview` in den Routendaten. Erst dann
aktiviert der Provider lokale Testbuchungen für alle Unternehmensarten. Diese
Vorschau verschickt keine E-Mails. `?ansicht=erfolg` zeigt dort eine gekennzeichnete
Erfolgsansicht ohne Buchung. Auf Produktionsrouten bleibt der Parameter wirkungslos.

Die Buchung bleibt beim Tabwechsel erhalten. Die Service-/Friseurauswahl nutzt
dieselben FormControls wie die bestehende Buchung. Dialoge unterstützen Escape
und Fokusführung, Tabs Pfeiltasten sowie Home/Ende. Die Gestaltung ist auf
`.profile-preview` beschränkt; Animationen respektieren `prefers-reduced-motion`.
Der Teilen-Button kopiert den aktuellen Buchungslink. NexTime erscheint im Footer.

Bildquellen und Generierungsprompts der lokalen Beispiele:
`public/media/profile-preview/ASSETS.md`.
