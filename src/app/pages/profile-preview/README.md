# Lokale Unternehmensprofil-Vorschau

Mit `npm start` starten und `http://localhost:4200/vorschau/salon/atelier7` öffnen.
Die Route ist ausschließlich im Entwicklungsmodus auf `localhost` aktiv.

Diese UI-Vorschau enthält die Bereiche Termin, Leistungen und Über uns.
„Über uns“ zeigt ausschließlich Öffnungszeiten und Adresse mit Kartenlink.
Profiltexte, Adresse, Öffnungszeiten und Leistungen sind erfundene Beispieldaten.
Sie werden über einen Provider dieser Seite bereitgestellt und nicht als
Unternehmenseinstellungen gespeichert. Es gibt keinen verbundenen Profileditor.
Bewertungen und Teamfotos werden nicht angezeigt; eine Google-Anbindung fehlt.

Für die Terminanfrage wird die vorhandene `RestaurantPageComponent` eingebunden.
Sie bleibt beim Tabwechsel bestehen, damit Formularwerte erhalten bleiben.
Der optionale Darstellungsparameter `salonFieldsTemplate` ersetzt ausschließlich
hier die Service- und Friseurauswahl durch gut lesbare Auswahldialoge. Die Dialoge
verwenden dieselben Formularfelder, Optionen und Validatoren wie zuvor. Auf anderen
Buchungsseiten bleiben die bisherigen nativen Auswahlfelder erhalten.

Die lokale Atelier7-Vorschau speichert Testanfragen im Browser. Buchungslogik,
API-Code, Mailversand und Unternehmensdaten bleiben unverändert. Das Herz und
die Merken-Funktion wurden entfernt. Der Teilen-Button kopiert nur den Seitenlink.

Die Profilgestaltung ist auf `.profile-preview` begrenzt. Animationen respektieren
`prefers-reduced-motion`. Foto- und Auswahldialoge verwenden native Dialoge mit
Fokussteuerung und Escape zum Schließen. Die Reiter unterstützen Pfeiltasten,
Home und Ende. Der Termin-Button führt zum Kalender oder begonnenen Detailschritt.
Abstand für die fixe Buchungsleiste wird nur reserviert, wenn sie angezeigt wird.
Das Logo stammt aus `public/nextimeNeuesLogo.png`.

Bildquellen und Generierungsprompt: `public/media/profile-preview/ASSETS.md`.
