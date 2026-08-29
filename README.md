# WärmeTakt

WärmeTakt macht Einstellungsänderungen an Wärmepumpen messbar. Die App vergleicht Messperioden vor und nach einer Änderung, berücksichtigt die Außentemperatur und zeigt, ob Energie gespart wurde, ohne den Raumkomfort zu verschlechtern.

## MVP

- Deutsch und Englisch mit automatischer Sprachauswahl
- Lokale Speicherung der Tagesmesswerte (SQLite)
- Wetterbereinigter Vorher-/Nachher-Vergleich
- COP, Verdichterstarts und Raumkomfort auf einen Blick
- Geführte Einstellungstests
- Vorbereitung für den einmaligen In-App-Kauf `WärmeTakt Pro`
- Geführter Test-Assistent mit Free-Limit und dauerhafter Pro-Freischaltung
- Celsius und Fahrenheit für den internationalen Einsatz

## Geschäftsmodell

Die App ist kostenlos installierbar. Ein kostenloser Test zeigt den Kernnutzen. `WärmeTakt Pro` wird als nicht verbrauchbarer In-App-Kauf angeboten und schaltet unbegrenzte Tests, Langzeitvergleiche, CSV-Importe, PDF-Berichte sowie künftige Verbindungen frei. Vorgesehener Startpreis: 39,99 € beziehungsweise Apples lokalisierte Preisstufe.

## Entwicklung

```bash
npm install
npm run start
npm run typecheck
```

Technik: Expo SDK 57, React Native, TypeScript und Expo SQLite.

In-App-Produkt: `de.kamilunavo.waermetakt.pro` (nicht verbrauchbar).

Bundle-ID iOS / Paketname Android: `de.kamilunavo.waermetakt`
