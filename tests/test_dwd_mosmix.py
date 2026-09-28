"""Tests for the rain-probability and wind/Beaufort math in dwd_mosmix."""
from datetime import datetime, timedelta, timezone

import pytest

from dwd_mosmix import (
    _combine_probabilities,
    _parse_dm,
    _window_value,
    beaufort,
)

NOW = datetime(2026, 9, 28, 6, 20, tzinfo=timezone.utc)
# Hourly grid starting at the full hour before NOW, like MOSMIX timesteps.
TIMESTEPS = [datetime(2026, 9, 28, 6, tzinfo=timezone.utc) + timedelta(hours=i) for i in range(10)]


@pytest.mark.parametrize(
    ("hourly", "expected"),
    [
        ([0, 0, 0], 0),
        ([100, 0], 100),
        ([50], 50),
        ([50, 50], 75),
        ([10, 20, 30], 50),  # 1 - 0.9*0.8*0.7 = 0.496
        ([30, 30, 30, 30], 76),  # 1 - 0.7**4 = 0.7599
    ],
)
def test_combine_probabilities(hourly, expected):
    assert _combine_probabilities(hourly) == expected


@pytest.mark.parametrize("hourly", [[], [10, None, 20], [None]])
def test_combine_probabilities_missing(hourly):
    assert _combine_probabilities(hourly) is None


@pytest.mark.parametrize(
    ("speed", "force"),
    [
        (0.0, 0),
        (0.29, 0),
        (0.3, 1),
        (1.59, 1),
        (1.6, 2),
        (5.5, 4),
        (10.7, 5),
        (10.8, 6),
        (17.2, 8),
        (32.6, 11),
        (32.7, 12),
        (60.0, 12),
    ],
)
def test_beaufort(speed, force):
    assert beaufort(speed) == force


def test_beaufort_bounds_cover_all_forces():
    # Every force 0..12 is reachable and monotonic.
    forces = [beaufort(v / 10) for v in range(0, 400)]
    assert forces == sorted(forces)
    assert set(forces) == set(range(13))


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("52.30", 52.5), ("-3.15", -3.25), ("0.00", 0.0)],
)
def test_parse_dm(raw, expected):
    assert _parse_dm(raw) == pytest.approx(expected)


def test_window_probability_uses_hours_after_now():
    values = ["99", "10", "20", "30", "40", "50", "0", "0", "0", "0"]
    value, hourly, end = _window_value("probability", TIMESTEPS, values, NOW, 2)
    # 06:00 is before NOW, so the window is 07:00 and 08:00.
    assert hourly == [10, 20]
    assert value == 28  # 1 - 0.9*0.8 = 0.28
    assert end == TIMESTEPS[2]


def test_window_max_for_wind():
    values = ["30.0", "3.14", "7.96", "5.0", "12.0", "1.0", "1.0", "1.0", "1.0", "1.0"]
    value, hourly, end = _window_value("max", TIMESTEPS, values, NOW, 3)
    assert hourly == [3.1, 8.0, 5.0]
    assert value == 8.0
    assert end == TIMESTEPS[3]


def test_window_missing_value_yields_none():
    values = ["0", "10", "-", "30", "0", "0", "0", "0", "0", "0"]
    for kind in ("probability", "max"):
        value, hourly, _ = _window_value(kind, TIMESTEPS, values, NOW, 4)
        assert value is None
        assert hourly[1] is None


def test_window_horizon_too_short():
    values = ["0"] * len(TIMESTEPS)
    late = TIMESTEPS[-3]
    assert _window_value("probability", TIMESTEPS, values, late, 4) == (None, [], None)


def test_window_no_future_timesteps():
    values = ["0"] * len(TIMESTEPS)
    after = TIMESTEPS[-1] + timedelta(minutes=1)
    assert _window_value("max", TIMESTEPS, values, after, 2) == (None, [], None)
