# NexTime

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
