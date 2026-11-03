# NexTime

## Lokale Vorschau von Atelier7

Mit `npm start` starten und [localhost:4200/atelier7](http://localhost:4200/atelier7) öffnen.
Atelier7 bietet die Auswahl zwischen Salon und Hausbesuch an. Beide Varianten sind
unverbindliche Anfragen ohne Preisanzeige. Fahrtzeiten werden weiterhin manuell blockiert.

Auf localhost werden Testanfragen ausschließlich im Browser gespeichert; es werden keine
E-Mails verschickt. Im lokalen Unternehmensbereich (`/unternehmen/login`) können sie mit
Benutzername `atelier7` und Vorschau-PIN `123456` angesehen und verwaltet werden.
Diese Vorschau-Zugangsdaten gelten ausschließlich für die lokalen Beispieldaten.

Die API-Tests für Hausbesuche mit `npm run test:mobile` ausführen.

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
