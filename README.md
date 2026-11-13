# NexTime

Die öffentliche Profiloberfläche verwendet die bestehenden Buchungslinks `/:slug` und
`/r/:slug`; Links in Google und auf den Unternehmensseiten müssen nicht geändert werden.
Für den Livegang zuerst `supabase-profile-rollout.sql` im bestehenden Supabase-PROD-Projekt
ausführen. Die genaue Reihenfolge steht in [der Merge-Anleitung](docs/merge-unternehmensprofil.md).

## PRO-Profil und bestehende Kunden

In der neuen Profiloberfläche sind **Fotos**, **Über uns** und **Leistungen** bzw.
**Speisekarte** ausschließlich für Unternehmen mit `planTier: 'pro'` sichtbar.
Starter zeigt direkt die Buchung mit Unternehmenslogo, Name, Adresse und Öffnungszeiten.
Die notwendige Serviceauswahl im Buchungsformular bleibt für jeden Friseursalon erhalten.
Im Adminbereich werden die zusätzlichen Profilfelder bei Starter mit einem PRO-Hinweis
ausgeblendet. Ein Tarifwechsel löscht keine gespeicherten Profilinhalte.

Vor dem PROD-Rollout die kombinierte Migration `supabase-profile-rollout.sql`
ausführen. Sie ergänzt die Profilspalte und bei Bedarf die Tarifspalte und stellt alle zu diesem Zeitpunkt
vorhandenen Unternehmen auf PRO um und sichert ihre bisherigen Tarifwerte im nicht
öffentlichen Schema `nextime_migrations`. Ein Migrationsmerkmal verhindert, dass eine
erneute Ausführung später angelegte Starter-Kunden oder manuelle Downgrades verändert.
Neue Unternehmen behalten ihren bisherigen Starter-Standard. Buchungsregeln, Kontaktdaten,
PINs und Mailkonfiguration werden nicht geändert.

Die PROD-Migration ist vorbereitet, aber noch nicht ausgeführt. Sie kann im SQL Editor
des richtigen PROD-Projekts oder über eine damit verbundene Sitzung ausgeführt werden.
Die beiden lokalen Profilbeispiele
werden separat einmalig auf PRO gesetzt. Spätere manuelle Tarifwechsel bleiben erhalten.

## Adminstatistik

Unter `/admin/statistiken` stehen Gesamtzahlen, Vergleiche je Unternehmen und ein
anklickbarer Verlauf über sechs Kalendermonate zur Verfügung. Der laufende Monat
wird bis heute mit den entsprechenden Tagen des Vormonats verglichen; bei kürzeren
Vormonaten endet der Vergleich an dessen letztem Tag. Abgeschlossene Monate werden
mit dem vollständigen Vormonat verglichen, 30 Tage mit den vorherigen 30 Tagen.
Für „Gesamt“ wird kein Vorperiodenvergleich angezeigt.

Gezählt wird nach dem Eingang in der Zeitzone Europe/Berlin. Offene Anfragen und
Buchungen werden getrennt ausgewiesen; bestätigte Anfragen zählen einmal als Buchung
im ursprünglichen Eingangsmonat. Abgelehnte Anfragen, interne Einträge und Blockierungen
sind ausgeschlossen. Die Monatsgrafik zeigt dieselben Zählregeln für ganze Kalendermonate.

Auf localhost werden die gespeicherten Testbuchungen und -anfragen ausgewertet.
**Beispieldaten ansehen** aktiviert ausdrücklich gekennzeichnete, rein fiktive Zahlen
ohne Schreibzugriff. Sie werden weder mit eigenen Daten vermischt noch in PROD angeboten.
Die Erweiterung benötigt keine neue Datenbankspalte. Tests: `npm run test:stats`.

## Lokale Vorschau von Atelier7

Mit `npm start` starten und [localhost:4200/atelier7](http://localhost:4200/atelier7) öffnen.
Atelier7 bietet die Auswahl zwischen Salon und Hausbesuch an. Beide Varianten sind
unverbindliche Anfragen ohne Preisanzeige. Fahrtzeiten werden weiterhin manuell blockiert.

Auf localhost werden Testanfragen ausschließlich im Browser gespeichert; es werden keine
E-Mails verschickt. Im lokalen Unternehmensbereich (`/unternehmen/login`) können sie mit
Benutzername `atelier7` und Vorschau-PIN `123456` angesehen und verwaltet werden.
Diese Vorschau-Zugangsdaten gelten ausschließlich für die lokalen Beispieldaten.

Die API-Tests für Hausbesuche mit `npm run test:mobile` ausführen.

Die neue Profiloberfläche ist unter
[localhost:4200/vorschau/salon/atelier7](http://localhost:4200/vorschau/salon/atelier7)
verfügbar. Der Einstieg zeigt direkt die Buchung mit Kalender. Leistungen, Fotos und
Öffnungszeiten/Adresse haben eigene Reiter; die Buchungseingaben bleiben beim Wechsel erhalten.
Diese Designvorschau ist ausschließlich im Entwicklungsmodus auf localhost erreichbar
und verwendet fiktive Profilinformationen sowie die lokale Testbuchung ohne E-Mail-Versand.

## Profile, Fotos und Speisekarten bearbeiten

Der Einstieg unter `/admin` zeigt die Kundenübersicht mit Suche und Betriebsart-Filtern.
**Unternehmen hinzufügen** öffnet das separate Formular unter `/admin/neu`;
**Bearbeiten** öffnet die Einstellungen des ausgewählten Unternehmens.

Im Adminbereich unter `/admin/unternehmen/:slug` gibt es den Abschnitt
**Profil & Fotos**. Dort lassen sich Begrüßung, Vorstellungstext, Galerie und
Leistungsbeschreibungen bzw. Speisekarte pflegen. Änderungen werden mit
**Änderungen speichern** übernommen. Ein leerer Vorstellungstext blendet den
Abschnitt aus; ohne Fotos verschwindet der Fotos-Reiter. Die erste Aufnahme ist
auch das kleine Bild neben der Begrüßung.

Die Vorschau liest die gespeicherten Unternehmensangaben. Beispiele:

- Salon: `/vorschau/salon/atelier7`
- Restaurant: `/vorschau/restaurant/osteria-demo`

Auf localhost sind auch Restaurant-Testbuchungen in diesen Vorschau-Routen lokal;
es werden keine Reservierungs- oder Mail-APIs aufgerufen. Normale öffentliche
Buchungsrouten verwenden die neue Oberfläche mit der bestehenden Buchungs-API. Der lokale Admin-Login verwendet wie bisher
die konfigurierte Admin-E-Mail und ein mindestens sechs Zeichen langes Passwort.

Die öffentlichen Routen laden dieselbe Profiloberfläche ohne lokale Vorschauhinweise.
Echte Unternehmen erhalten bei fehlenden Profilangaben neutrale Texte und keine
erfundenen Fotos, Speisen oder Vorstellungen. Generierte Fotos werden nur bei den
lokalen Beispielfirmen automatisch eingesetzt; im Admin lassen sie sich ausdrücklich
über „Passende Beispielbilder verwenden“ auswählen. Für den PROD-Rollout liegt die kombinierte Migration
`supabase-profile-rollout.sql` bereit. Sie wurde nicht ausgeführt. Die API speichert
Profilinhalte nur mit einer gültigen Admin-Sitzung und meldet eine fehlende Spalte,
statt Änderungen still zu verwerfen. Alte Updates ohne `profile` erhalten bestehende
Profilinhalte; die Unternehmensübersicht lädt keine Galerien mit.

`npm run test:profile` prüft Normalisierung, Admin-Berechtigung, Speichern/Lesen und
das Verhalten bei fehlender Migration. Bildquellen und Generierungsprompts stehen
in `public/media/profile-preview/ASSETS.md`.

Hochgeladene Fotos behalten bis zu 2.400 Pixel an der längsten Kante und erhalten
bis zu 500.000 Zeichen pro Bild. Größere Dateien werden mit hoher WebP-Qualität
angepasst; passende kleine Originaldateien bleiben unverändert. Logos behalten
bis zu 640 Pixel und transparente Hintergründe. Bereits stark verkleinerte Fotos
müssen aus der Originaldatei erneut hochgeladen werden. Frontend und API gemeinsam
bereitstellen, damit der gemeinsame Profil-Normalisierer größere Bilder akzeptiert.
Die Bildverarbeitung prüft `npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/shared/company-image-upload.spec.ts` im Browser.

Restaurantkarten zeigen jeweils eine Kategorie und höchstens acht Positionen pro
Seite. Der gemeinsame Profil-Normalisierer unterstützt bis zu 300 Positionen;
Preistexte erhalten auch mehrere Getränkegrößen und ihre jeweiligen Preise.
Allergene und Hinweise sind aufklappbar, die Original-PDF ist separat verlinkt.

Für **Osteria da Michele** liegt die vom Nutzer bereitgestellte Karte mit 138
Positionen in 16 Kategorien unter `public/menus/osteria-da-michele.json`; das
Original liegt unter `public/media/menus/osteria-da-michele.pdf`. Im leeren
Speisekarten-Editor dieses Unternehmens lädt **Speisekarte von Osteria da Michele
übernehmen** die vollständige Karte ins Formular. Erst **Änderungen speichern**
speichert sie. Bestehende Karten werden nicht überschrieben.

Alternativ erzeugt `node scripts/prepare-osteria-menu-import.mjs` den gezielten
Datenbankimport `docs/data-imports/osteria-da-michele-menu.sql`. Der Import prüft ID,
Slug, Name und Betriebsart, erhält übrige Profilfelder und lehnt das Überschreiben
einer abweichenden bestehenden Karte ab. **API und Frontend zuerst gemeinsam
bereitstellen:** ältere API-Versionen begrenzen Karten noch auf 60 Positionen.
Das Erzeugen der SQL-Datei führt keine Datenbankänderungen aus.

## Empfehlungshinweis nach der Buchung

Nach einer erfolgreichen Anfrage oder Buchung steht im Erfolgsfenster ein dezenter
Empfehlungshinweis mit dem Namen des gebuchten Unternehmens. **Mehr erfahren** öffnet die
Bedingungen direkt darunter, auch per Tastatur. Der Hinweis ist unabhängig vom PRO-Tarif
des gebuchten Unternehmens. Bestätigungsmails erhalten keinen Empfehlungszusatz.

Direktansichten ohne Testbuchung, Reservierungsspeicherung oder E-Mail-Versand:

- Salon: `/vorschau/salon/atelier7?ansicht=erfolg`
- Restaurant: `/vorschau/restaurant/osteria-demo?ansicht=erfolg`

Diese Direktansichten sind ausschließlich im Entwicklungsmodus auf localhost aktiv.
Auf öffentlichen Produktionsrouten kann der Parameter keine Buchungsbestätigung auslösen.

Die vorgeschlagenen Aktionsbedingungen sind: 100-€-Gutschein für das gebuchte Unternehmen,
finanziert von NexTime, sobald sich der empfohlene neue Betrieb nach der Testphase
entscheidet, NexTime weiter zu nutzen;
eine Prämie pro Betrieb, keine Barauszahlung. Die Zuordnung und Ausgabe sind zunächst
manuell vorgesehen: Der Betrieb nennt bei seiner Kontaktaufnahme den Empfehlenden und das
Gutscheinunternehmen. Es werden keine Kontakte automatisch angeschrieben oder übertragen.
Vor einem Livegang müssen Finanzierung, Gutscheinausgabe bei den beteiligten Unternehmen
und die endgültigen Aktionsbedingungen feststehen; es wurde kein Prämien-Backend gebaut.

## Push-Benachrichtigungen und Conversion-Statistik

Vor dem Deployment einmal `supabase-push-conversion.sql` im Supabase SQL Editor ausführen.

VAPID-Schlüssel lokal erzeugen:

```bash
npm run vapid:generate
```

Anschließend folgende Variablen in Vercel für Production, Preview und Development hinterlegen:

```text
VAPID_PUBLIC_KEY=<Public Key aus dem Befehl>
VAPID_PRIVATE_KEY=<Private Key aus dem Befehl>
VAPID_SUBJECT=mailto:webdesignodobasic@gmail.com
```

Auf dem iPhone funktionieren Push-Benachrichtigungen ab iOS 16.4 in der zum Home-Bildschirm
hinzugefügten NexTime-Web-App. Die Berechtigung wird im Unternehmenskalender über den Button
„Aktivieren“ erteilt.
