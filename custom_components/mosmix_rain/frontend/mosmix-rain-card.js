/*
 * MOSMIX Rain Predict card: rain probability and wind for the next 2/4/8
 * hours in one grid. Shipped with and auto-registered by the integration.
 *
 * Sensors are discovered by their `element` and `window_hours` attributes,
 * so renamed entity ids keep working. With several instances, `device_id`
 * picks one; otherwise the first match wins.
 */

const CARD_VERSION = "0.6.0";
const DOMAIN = "mosmix_rain";
const HOURS = [2, 4, 8];

const ROWS = {
  rain: { code: "wwP", kind: "rain", icon: "mdi:weather-rainy" },
  rain_01: { code: "R101", kind: "rain", icon: "mdi:weather-rainy" },
  rain_10: { code: "R110", kind: "rain", icon: "mdi:weather-pouring" },
  wind: { code: "FF", kind: "wind", icon: "mdi:weather-windy" },
  gust: { code: "FX1", kind: "wind", icon: "mdi:weather-windy-variant" },
};
const DEFAULT_ROWS = ["rain", "wind", "gust"];

// Factors to m/s for the wind speed units Home Assistant can display.
const TO_MS = { "m/s": 1, "km/h": 1 / 3.6, kn: 0.514444, mph: 0.44704, "ft/s": 0.3048 };
const WIND_UNITS = ["m/s", "km/h", "kn", "mph", "bft"];

const STRINGS = {
  de: {
    title: "Regen & Wind",
    rows: {
      rain: "Regen",
      rain_01: "Regen > 0,1 mm",
      rain_10: "Regen > 1 mm",
      wind: "Wind",
      gust: "Böen",
    },
    until: "bis",
    updated: "Stand",
    not_found: "Keine Sensoren von MOSMIX Rain Predict gefunden.",
    editor: {
      title: "Titel (leer = kein Titel)",
      device_id: "Standort (nur bei mehreren nötig)",
      rows: "Zeilen",
      wind_unit: "Windeinheit",
      show_station: "Station und Stand anzeigen",
      auto: "wie in Home Assistant",
    },
  },
  en: {
    title: "Rain & wind",
    rows: {
      rain: "Rain",
      rain_01: "Rain > 0.1 mm",
      rain_10: "Rain > 1 mm",
      wind: "Wind",
      gust: "Gusts",
    },
    until: "until",
    updated: "Updated",
    not_found: "No MOSMIX Rain Predict sensors found.",
    editor: {
      title: "Title (empty = no title)",
      device_id: "Location (only needed with several)",
      rows: "Rows",
      wind_unit: "Wind unit",
      show_station: "Show station and update time",
      auto: "as in Home Assistant",
    },
  },
};

function strings(hass) {
  const lang = (hass && hass.language) || "en";
  return STRINGS[lang.split("-")[0]] || STRINGS.en;
}

function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function windLevel(bft) {
  if (bft >= 8) return "storm";
  if (bft >= 6) return "strong";
  if (bft >= 4) return "fresh";
  return "calm";
}

function findEntities(hass, deviceId) {
  const codes = new Set(Object.values(ROWS).map((r) => r.code));
  const found = {};
  for (const entityId of Object.keys(hass.states).sort()) {
    if (!entityId.startsWith("sensor.")) continue;
    const attrs = hass.states[entityId].attributes;
    if (!codes.has(attrs.element) || !HOURS.includes(attrs.window_hours)) continue;
    if (attrs.station_id === undefined) continue;
    if (deviceId && hass.entities && hass.entities[entityId]?.device_id !== deviceId) continue;
    const key = `${attrs.element}_${attrs.window_hours}`;
    if (!(key in found)) found[key] = entityId;
  }
  return found;
}

class MosmixRainCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("mosmix-rain-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    const rows = config.rows || DEFAULT_ROWS;
    const unknown = rows.filter((r) => !(r in ROWS));
    if (unknown.length) {
      throw new Error(`Unknown row(s): ${unknown.join(", ")}. Allowed: ${Object.keys(ROWS).join(", ")}`);
    }
    if (config.wind_unit && !WIND_UNITS.includes(config.wind_unit)) {
      throw new Error(`Unknown wind_unit "${config.wind_unit}". Allowed: ${WIND_UNITS.join(", ")}`);
    }
    this._config = { show_station: true, ...config, rows };
    this._entities = null;
    this._lastStates = null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const entities = this._entities;
    if (!entities || Object.keys(entities).length < this._config.rows.length * HOURS.length) {
      this._entities = findEntities(hass, this._config.device_id);
    }
    const states = Object.values(this._entities).map((id) => hass.states[id]);
    if (this._lastStates && states.length === this._lastStates.length &&
        states.every((s, i) => s === this._lastStates[i])) {
      return;
    }
    this._lastStates = states;
    this._render();
  }

  getCardSize() {
    return 2 + this._config.rows.length;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  _format(value, digits) {
    const lang = this._hass.locale?.language || this._hass.language;
    return new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(value);
  }

  _time(iso) {
    const lang = this._hass.locale?.language || this._hass.language;
    return new Date(iso).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
  }

  _rainCell(stateObj) {
    const value = Number(stateObj.state);
    return `
      <div class="value">${this._format(value, 0)}<small> %</small></div>
      <div class="bar"><div class="fill rain" style="width:${Math.min(100, value)}%"></div></div>`;
  }

  _windCell(stateObj) {
    const attrs = stateObj.attributes;
    const bft = attrs.beaufort;
    const level = windLevel(bft);
    const target = this._config.wind_unit;
    let main;
    let sub;
    if (target === "bft") {
      main = `${bft}<small> Bft</small>`;
      sub = esc(attrs.beaufort_name);
    } else {
      const unit = attrs.unit_of_measurement;
      let value = Number(stateObj.state);
      let shown = unit;
      if (target && TO_MS[unit] && TO_MS[target]) {
        value = (value * TO_MS[unit]) / TO_MS[target];
        shown = target;
      }
      const digits = shown === "m/s" || shown === "kn" ? 1 : 0;
      main = `${this._format(value, digits)}<small> ${esc(shown)}</small>`;
      sub = `Bft ${bft}`;
    }
    return `
      <div class="value">${main}</div>
      <div class="bar"><div class="fill ${level}" style="width:${Math.min(100, (bft / 10) * 100)}%"></div></div>
      <div class="sub" title="${esc(attrs.beaufort_name)}">${sub}</div>`;
  }

  _cell(row, hours) {
    const entityId = this._entities[`${ROWS[row].code}_${hours}`];
    const stateObj = entityId && this._hass.states[entityId];
    if (!stateObj) return `<div class="cell empty">–</div>`;
    const known = !["unknown", "unavailable"].includes(stateObj.state);
    const body = !known ? `<div class="value">–</div>`
      : ROWS[row].kind === "rain" ? this._rainCell(stateObj) : this._windCell(stateObj);
    return `<div class="cell" role="button" tabindex="0" data-entity="${esc(entityId)}">${body}</div>`;
  }

  _render() {
    if (!this._config || !this._hass || !this._entities) return;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (ev) => this._moreInfo(ev));
      this.shadowRoot.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") this._moreInfo(ev);
      });
    }
    const t = strings(this._hass);
    const title = this._config.title ?? t.title;
    const header = title ? `<h1 class="card-header">${esc(title)}</h1>` : "";

    const anyId = Object.values(this._entities)[0];
    if (!anyId) {
      this.shadowRoot.innerHTML = `${STYLE}<ha-card>${header}<div class="missing">${esc(t.not_found)}</div></ha-card>`;
      return;
    }

    const heads = HOURS.map((h) => {
      const any = Object.values(ROWS)
        .map((r) => this._hass.states[this._entities[`${r.code}_${h}`]])
        .find((s) => s && s.attributes.window_end);
      const until = any ? `<span>${t.until} ${this._time(any.attributes.window_end)}</span>` : "";
      return `<div class="head">${h} h${until}</div>`;
    }).join("");

    const rows = this._config.rows.map((row) => `
      <div class="label"><ha-icon icon="${ROWS[row].icon}"></ha-icon><span>${esc(t.rows[row])}</span></div>
      ${HOURS.map((h) => this._cell(row, h)).join("")}`).join("");

    let footer = "";
    const attrs = this._hass.states[anyId]?.attributes;
    if (this._config.show_station && attrs) {
      footer = `<div class="footer">${esc(attrs.station_name)} · ${this._format(attrs.station_distance_km, 1)} km
        · ${t.updated} ${this._time(attrs.updated)}</div>`;
    }

    this.shadowRoot.innerHTML = `${STYLE}
      <ha-card>
        ${header}
        <div class="grid${header ? "" : " no-header"}"><div></div>${heads}${rows}</div>
        ${footer}
      </ha-card>`;
  }

  _moreInfo(ev) {
    const cell = ev.composedPath().find((el) => el.dataset && el.dataset.entity);
    if (!cell) return;
    ev.preventDefault();
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      detail: { entityId: cell.dataset.entity },
      bubbles: true,
      composed: true,
    }));
  }
}

const STYLE = `<style>
  ha-card { container-type: inline-size; }
  .grid {
    display: grid;
    grid-template-columns: auto repeat(3, 1fr);
    gap: 6px;
    padding: 0 16px 12px;
    align-items: stretch;
  }
  .grid.no-header { padding-top: 16px; }
  .head {
    text-align: center;
    font-weight: 500;
    display: flex;
    flex-direction: column;
  }
  .head span, .sub, .footer {
    font-size: 0.8em;
    color: var(--secondary-text-color);
    font-weight: normal;
  }
  .label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 4px;
    color: var(--secondary-text-color);
  }
  .label span { color: var(--primary-text-color); white-space: nowrap; }
  .cell {
    text-align: center;
    padding: 8px 6px;
    border-radius: 8px;
    background: var(--secondary-background-color);
    cursor: pointer;
    outline: none;
  }
  .cell:focus-visible { box-shadow: 0 0 0 2px var(--primary-color); }
  .cell.empty { cursor: default; color: var(--secondary-text-color); }
  .value { font-size: 1.25em; font-weight: 500; line-height: 1.3; }
  .value small { font-size: 0.6em; font-weight: normal; color: var(--secondary-text-color); }
  .bar {
    height: 4px;
    margin: 4px 0 2px;
    border-radius: 2px;
    background: var(--divider-color);
    overflow: hidden;
  }
  .fill { height: 100%; border-radius: 2px; }
  .fill.rain { background: var(--mosmix-rain-color, var(--blue-color, #2196f3)); }
  .fill.calm { background: var(--mosmix-wind-calm-color, var(--green-color, #4caf50)); }
  .fill.fresh { background: var(--mosmix-wind-fresh-color, var(--amber-color, #ffc107)); }
  .fill.strong { background: var(--mosmix-wind-strong-color, var(--orange-color, #ff9800)); }
  .fill.storm { background: var(--mosmix-wind-storm-color, var(--red-color, #f44336)); }
  .footer { padding: 0 16px 12px; }
  .missing { padding: 16px; color: var(--secondary-text-color); }
  @container (max-width: 320px) {
    .label span { display: none; }
    .grid { padding: 0 8px 8px; gap: 4px; }
  }
</style>`;

class MosmixRainCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _schema(t) {
    return [
      { name: "title", selector: { text: {} } },
      { name: "device_id", selector: { device: { filter: { integration: DOMAIN } } } },
      {
        name: "rows",
        selector: {
          select: {
            multiple: true,
            options: Object.keys(ROWS).map((r) => ({ value: r, label: t.rows[r] })),
          },
        },
      },
      {
        name: "wind_unit",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "auto", label: t.editor.auto },
              ...WIND_UNITS.map((u) => ({ value: u, label: u === "bft" ? "Beaufort" : u })),
            ],
          },
        },
      },
      { name: "show_station", selector: { boolean: {} } },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    const t = strings(this._hass);
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (schema) => t.editor[schema.name];
      this._form.addEventListener("value-changed", (ev) => {
        const config = { ...ev.detail.value };
        if (config.wind_unit === "auto") delete config.wind_unit;
        if (!config.device_id) delete config.device_id;
        this.dispatchEvent(new CustomEvent("config-changed", {
          detail: { config },
          bubbles: true,
          composed: true,
        }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema(t);
    this._form.data = {
      title: t.title,
      rows: DEFAULT_ROWS,
      wind_unit: "auto",
      show_station: true,
      ...this._config,
    };
  }
}

customElements.define("mosmix-rain-card", MosmixRainCard);
customElements.define("mosmix-rain-card-editor", MosmixRainCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "mosmix-rain-card",
  name: "MOSMIX Regen & Wind",
  description: "Regenwahrscheinlichkeit und Wind für die nächsten 2, 4 und 8 Stunden.",
  preview: true,
  documentationURL: "https://github.com/emente/homeassistant_dwd_weatherpredict",
});

console.info(`%c MOSMIX-RAIN-CARD %c ${CARD_VERSION} `, "color:white;background:#2196f3", "");
