"""Load dwd_mosmix.py directly so tests don't need Home Assistant installed.

Importing it via the package would run custom_components/mosmix_rain/__init__.py,
which imports homeassistant.
"""
import importlib.util
import sys
from pathlib import Path

_PATH = Path(__file__).parent.parent / "custom_components" / "mosmix_rain" / "dwd_mosmix.py"
_spec = importlib.util.spec_from_file_location("dwd_mosmix", _PATH)
dwd_mosmix = importlib.util.module_from_spec(_spec)
sys.modules["dwd_mosmix"] = dwd_mosmix
_spec.loader.exec_module(dwd_mosmix)
