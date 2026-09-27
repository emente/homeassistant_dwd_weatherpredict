"""The MOSMIX Rain Predict integration."""
from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from .const import DOMAIN
from .coordinator import MosmixRainCoordinator

try:
    from homeassistant.components.http import StaticPathConfig
except ImportError:  # Home Assistant < 2024.7
    StaticPathConfig = None

PLATFORMS = ["sensor"]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

CARD_FILENAME = "mosmix-rain-card.js"
CARD_URL = f"/{DOMAIN}/{CARD_FILENAME}"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the dashboard card and load it on every dashboard.

    The version query string makes browsers fetch the new file after an
    update instead of using a cached copy.
    """
    path = str(Path(__file__).parent / "frontend" / CARD_FILENAME)
    if StaticPathConfig is not None:
        await hass.http.async_register_static_paths([StaticPathConfig(CARD_URL, path, False)])
    else:
        hass.http.register_static_path(CARD_URL, path, cache_headers=False)
    integration = await async_get_integration(hass, DOMAIN)
    add_extra_js_url(hass, f"{CARD_URL}?v={integration.version}")
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    coordinator = MosmixRainCoordinator(
        hass,
        latitude=entry.options.get("latitude", entry.data["latitude"]),
        longitude=entry.options.get("longitude", entry.data["longitude"]),
    )
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok
