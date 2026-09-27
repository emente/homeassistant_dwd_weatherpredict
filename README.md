# MOSMIX Rain Predict

Home-Assistant-Integration für Regen- und Windvorhersagen der nächsten
2, 4 und 8 Stunden, mit Daten direkt vom Deutschen Wetterdienst (DWD).
Kein Account und kein API-Schlüssel nötig.

## Sensoren

15 Sensoren, jeweils für **2h, 4h und 8h ab jetzt**:

- **Regenwahrscheinlichkeit** (9 Sensoren): Wahrscheinlichkeit, dass es
  irgendwann in diesem Zeitraum regnet. Es gibt drei Varianten: jeder
  Niederschlag, mehr als 0,1 mm und mehr als 1,0 mm pro Stunde.
- **Wind** (6 Sensoren): höchste erwartete Windgeschwindigkeit und
  höchste erwartete Windböe im Zeitraum, mit den Attributen `beaufort`
  und `beaufort_name`.

Die nächstgelegene DWD-Station wird automatisch gewählt, die Daten
werden alle 30 Minuten aktualisiert.

**Hinweis:** Der DWD liefert Regenwahrscheinlichkeiten nur pro Stunde.
Die Werte für 2h/4h/8h werden daraus berechnet und liegen tendenziell
etwas zu hoch. Die Einzelwerte stehen im Attribut `hourly_values`.

## Installation

Schnellinstallation über My Home Assistant. Die Links öffnen die passende
Seite in deiner eigenen Home-Assistant-Instanz:

| Schritt | Link |
|---|---|
| 1. Repository in HACS öffnen und installieren | [![In HACS öffnen](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=emente&repository=homeassistant_dwd_weatherpredict&category=integration) |
| 2. Nach dem Neustart: Integration einrichten | [![Integration hinzufügen](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=mosmix_rain) |
| 3. Karte zu einem Dashboard hinzufügen | [![Dashboards öffnen](https://my.home-assistant.io/badges/lovelace_dashboards.svg)](https://my.home-assistant.io/redirect/lovelace_dashboards/) |
| Später: Standort ändern, Sensoren ansehen | [![Integration öffnen](https://my.home-assistant.io/badges/integration.svg)](https://my.home-assistant.io/redirect/integration/?domain=mosmix_rain) |

### Von Hand über HACS

1. In Home Assistant: **HACS → ⋮ → Benutzerdefinierte Repositories**.
2. `https://github.com/emente/homeassistant_dwd_weatherpredict` mit
   Kategorie **Integration** hinzufügen.
3. **MOSMIX Rain Predict** installieren, danach Home Assistant neu
   starten.
4. **Einstellungen → Geräte & Dienste → Integration hinzufügen**, nach
   **MOSMIX Rain Predict** suchen.
5. Breiten-/Längengrad bestätigen oder anpassen (vorbelegt mit dem
   Home-Assistant-Standort) und absenden.

Den Standort kannst du später unter **Geräte & Dienste → MOSMIX Rain
Predict → Konfigurieren** ändern.

## Dashboard-Karte

Die Integration bringt eine eigene Karte mit, die Regen und Wind für 2h,
4h und 8h als Raster zeigt. Sie wird automatisch geladen, du musst sie
weder separat installieren noch als Ressource eintragen.

Dashboard bearbeiten → **Karte hinzufügen** → **MOSMIX Regen & Wind**.
Alle Einstellungen gehen im grafischen Editor. In YAML sieht das so aus:

```yaml
type: custom:mosmix-rain-card
title: Regen & Wind
rows: [rain, wind, gust]
wind_unit: km/h
```

| Option | Standard | Bedeutung |
|---|---|---|
| `title` | `Regen & Wind` | Überschrift, `""` blendet sie aus |
| `rows` | `[rain, wind, gust]` | Zeilen in dieser Reihenfolge: `rain` (jeder Niederschlag), `rain_01` (> 0,1 mm), `rain_10` (> 1 mm), `wind`, `gust` |
| `wind_unit` | wie in Home Assistant | `m/s`, `km/h`, `kn`, `mph` oder `bft` (Beaufort) |
| `device_id` | erster Standort | nur nötig, wenn die Integration mehrfach eingerichtet ist |
| `show_station` | `true` | Station, Entfernung und Datenstand unten anzeigen |

Ein Klick auf einen Wert öffnet den Sensor mit Verlauf. Die Farbe der
Windbalken richtet sich nach der Beaufort-Stärke: grün bis 3, gelb 4–5,
orange 6–7, rot ab 8.

Taucht die Karte nach einem Update nicht auf, einmal die Browserseite
neu laden. In der Companion App hilft **Frontend-Cache zurücksetzen**
in den App-Einstellungen.

## Datenquelle

Deutscher Wetterdienst (DWD), MOSMIX_L, über
[opendata.dwd.de](https://opendata.dwd.de). Keine Verbindung zum DWD.
