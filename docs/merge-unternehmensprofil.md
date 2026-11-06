# Unternehmensprofil: Reihenfolge für Merge und Livegang

Prüfstand: 6. November 2026, Branch `feature/unternehmensprofil-ui`.
Diese Liste führt selbst keine Datenbankänderung und keinen Deploy aus.

1. **Die Umstellung ist im Code vorbereitet; die Kundenlinks bleiben gleich.**
   `/:slug` und `/r/:slug` laden die neue Profiloberfläche. Bestehende Links wie
   `https://www.nextime-booking.de/atelier7` bleiben gültig. Die öffentlichen
   Seiten verwenden die bisherigen Buchungs- und Verfügbarkeits-APIs und senden
   weiterhin Statistikereignisse. Der Empfehlungshinweis erscheint nach Erfolg.
   Die getrennten localhost-Vorschau-Routen bleiben für lokale Beispieldaten;
   nur diese erhalten die lokalen Buchungsprovider und Designhinweise.

2. **Beispielinhalte sind von echten Profilen getrennt.**
   `defaultCompanyProfile()` enthält neutrale Texte und keine Beispielfotos,
   Gerichte oder erfundenen Vorstellungen. Das gilt auch für das Adminformular.
   Die erfundenen Atelier7-/Restaurantinformationen gehören ausschließlich in die
   lokalen Beispielfirmen. Generierte Fotos werden dort automatisch eingesetzt;
   im Admin kann man gekennzeichnete Beispielbilder bewusst auswählen. Das bloße
   Öffnen eines Unternehmens im Editor ersetzt oder entfernt keine gespeicherten Fotos.
   Für die Gutscheinaktion müssen Finanzierung, Ausstellung beim gebuchten
   Unternehmen und die Bedingungen feststehen. Vorgesehen sind 100 €, nachdem sich
   der empfohlene neue Betrieb nach der Testphase für NexTime entscheidet;
   Zuordnung und Gutscheinausgabe erfolgen zunächst manuell.

3. **Das richtige Supabase-PROD-Projekt prüfen und sichern.**
   Im bestehenden PROD-Projekt arbeiten, kein neues Projekt anlegen oder die
   vorhandenen Verbindungswerte ersetzen. Vor Änderungen eine aktuelle Sicherung
   bzw. einen überprüfbaren Export und den vorherigen Live-Commit festhalten.
   Der Supabase-Pluginzugang ist optional, wenn die Abfragen im Dashboard selbst
   ausgeführt werden. Für eine Ausführung durch den Assistenten muss die Verbindung
   zum richtigen Projekt verfügbar sein.

   Zuerst ausschließlich lesend prüfen:

   ```sql
   select column_name, data_type, is_nullable, column_default
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'companies'
     and column_name in ('plan_tier', 'public_profile')
   order by column_name;

   select count(*) as companies_before
   from public.companies;

   select
     coalesce(to_jsonb(company)->>'plan_tier', '<fehlt oder leer>') as plan_tier,
     count(*) as companies
   from public.companies as company
   group by 1
   order by 1;
   ```

4. **Eine SQL-Datei vor dem App-Deploy ausführen.**
   Im SQL Editor des bestehenden PROD-Projekts eine neue Abfrage öffnen.
   Den vollständigen Inhalt von
   [supabase-profile-rollout.sql](../supabase-profile-rollout.sql) kopieren,
   einfügen und **Run** klicken. Nicht zusätzlich sämtliche anderen SQL-Dateien ausführen.
   Diese Datei ergänzt `public_profile` sowie bei Bedarf `plan_tier` und stellt
   alle dann bestehenden Unternehmen auf PRO. Sie sichert die vorherigen Tarifwerte
   im privaten Schema `nextime_migrations`; ein gemeinsamer Migrationsschlüssel
   schützt auch bei vorheriger Ausführung der separaten PRO-Datei vor Wiederholung.
   Alle Schritte laufen in einer Transaktion. Bei einem Fehler nicht mergen,
   sondern die Fehlermeldung prüfen. Der GitHub-Deploy führt diese Datei nicht aus.

   Anschließend Unternehmensanzahl und Tarifverteilung erneut prüfen. Die Anzahl
   muss unverändert sein; beim ersten erfolgreichen Upgrade müssen alle erfassten
   Bestandsunternehmen PRO sein. Neue Unternehmen behalten den Starter-Standard.
   Profilspalte und Tarifumstellung ändern keine Buchungen oder Mailkonfiguration.
   Falls das Projekt bereits CLI-Migrationen verwaltet, die Änderungen über dessen
   bestehenden Migrationsablauf ausführen, damit dessen Historie konsistent bleibt.

5. **Den vollständigen Stand prüfen und auf dem Featurebranch sichern.**
   `node --test tests/*.test.cjs`, `npm run build:prod` und die mobilen
   Buchungsabläufe prüfen. Bei einer Produktionsfreigabe muss zusätzlich der
   Produktionsbuild auf einer Testumgebung mit der echten API geprüft werden.
   Die automatisierten Browserprüfungen decken den Produktionsbuild mit abgefangenen
   HTTP-Antworten ab; reale Datenbankzugriffe und Mailzustellung brauchen den nachfolgenden Test.
   Admin: Kundenliste, Bearbeiten/Speichern und Statistik. Kunden: bestehende Links,
   Datum/Details, Anfragen, direkte Reservierungen und die PRO-/Starter-Unterschiede.
   Eine gezielte Testbuchung mit eigener Adresse muss Mailzustellung und Zuordnung
   bestätigen. Testdaten danach gezielt über die vorhandene Verwaltung entfernen.
   Die letzten Gutscheinänderungen sind zum Prüfzeitpunkt noch nicht committed;
   auch neue Dateien müssen im Commit und anschließend auf dem Featurebranch sein.

6. **API und Frontend passend bereitstellen, dann mergen.**
   Beim lesenden Online-Check antworteten sowohl `/atelier7` als auch die
   Unternehmens-API über Vercel mit HTTP 200. Im richtigen Vercel-Projekt prüfen,
   welcher Branch aktuell für Production eingestellt ist; für den vorgesehenen
   Ablauf muss dies `main` sein. Featurebranch-Deployments dürfen nicht versehentlich
   auf die Produktionsdomain zeigen.
   Der neue Admin benötigt auch die neue `api/companies.ts`, insbesondere das
   Speichern und Zurücklesen von `profile`. Der GitHub-Pages-Workflow im Repository
   baut nur das Frontend. Den tatsächlichen API-Deploy und seine Verknüpfung zum
   Branch deshalb vorab prüfen. Die bestehende API-Umgebung und die vorhandenen
   Supabase-/Resend-Schlüssel übernehmen.
   Ein Push bzw. Merge nach `main` startet laut
   [deploy.yml](../.github/workflows/deploy.yml) automatisch den Pages-Deploy.
   Erst nach den vorigen Schritten den Pull Request von
   `feature/unternehmensprofil-ui` nach `main` mergen und die Deploy-Ergebnisse
   sowie die öffentlichen Seiten und den Admin kontrollieren.

Bei einem Anwendungsfehler Frontend und gegebenenfalls API auf den vorherigen
funktionsfähigen Stand zurückrollen. Die additive Profilspalte kann bestehen bleiben;
eine Rücksetzung der gesamten Datenbank würde zwischenzeitliche Buchungen gefährden.
Eine gegebenenfalls notwendige Tarifkorrektur gezielt anhand der gesicherten
Migrationseinträge durchführen, damit spätere Änderungen nicht überschrieben werden.

Erneute Prüfung am 6. November 2026: Produktionsbuild erfolgreich (bestehende
Größenwarnungen), alle 36 API-/Logiktests bestanden. Die öffentlichen Routen im
Produktionsbuild bestehen Browserprüfungen mit abgefangenen API-Antworten für
Salon/Restaurant, PRO/Starter, Hausbesuch, Zeitraster, Mitarbeiterzuordnung,
Anfragen, direkte Buchungen, Statistikereignisse und ausgebuchte Termine.
Das Speichern im Admin und anschließende Lesen im öffentlichen Profil ist ebenfalls geprüft.
PROD-Datenbankänderungen und ein Livegang wurden dabei nicht ausgeführt.
