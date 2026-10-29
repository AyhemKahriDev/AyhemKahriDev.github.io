import json
import math
import re
import time
from urllib.parse import urlsplit

from snakevortex.config import DEFAULT_PLAYER_COLOR, MAX_RATE_LIMITER_ENTRIES

HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class RateLimiter:
    def __init__(self, requests_limit, window_seconds, max_entries=MAX_RATE_LIMITER_ENTRIES):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self.max_entries = max_entries
        self.storage = {}

    def is_allowed(self, client_ip):
        if not client_ip:
            return True

        current_time = time.time()
        requests = self.storage.setdefault(client_ip, [])
        requests[:] = [value for value in requests if current_time - value < self.window_seconds]

        if len(requests) >= self.requests_limit:
            return False

        requests.append(current_time)

        self.enforce_storage_limit(current_time)

        return True

    def enforce_storage_limit(self, current_time):
        if len(self.storage) <= self.max_entries:
            return

        stale_ips = [
            ip
            for ip, values in self.storage.items()
            if not values or current_time - max(values) > self.window_seconds * 2
        ]
        for ip in stale_ips:
            self.storage.pop(ip, None)

        overflow = len(self.storage) - self.max_entries
        if overflow <= 0:
            return

        oldest_ips = sorted(
            self.storage,
            key=lambda ip: max(self.storage[ip]) if self.storage[ip] else 0,
        )
        for ip in oldest_ips[:overflow]:
            self.storage.pop(ip, None)


def is_same_origin(headers):
    origin = headers.get("Origin")
    if not origin:
        return True

    host = headers.get("Host")
    if not host:
        return False

    try:
        parsed_origin = urlsplit(origin)
    except ValueError:
        return False

    if parsed_origin.scheme not in {"http", "https"} or not parsed_origin.netloc:
        return False

    return parsed_origin.netloc.lower() == host.lower()


def sanitize_name(name):
    if not isinstance(name, str):
        return ""

    cleaned = []
    for char in name.strip():
        if char.isalnum() or char in " _-":
            cleaned.append(char)
    return "".join(cleaned)[:15].strip()


def sanitize_color(color):
    if isinstance(color, str) and HEX_COLOR_RE.match(color):
        return color
    return DEFAULT_PLAYER_COLOR


def parse_direction(value):
    try:
        direction = float(value)
    except Exception:
        return None

    if not math.isfinite(direction):
        return None

    return direction % (2 * math.pi)


def parse_ping(value):
    try:
        ping = int(value)
    except Exception:
        return 0

    return max(0, min(5000, ping))


def parse_client_message(message, max_size):
    if not isinstance(message, str) or len(message) > max_size:
        return None

    try:
        payload = json.loads(message)
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None

    message_type = payload.get("type")
    if not isinstance(message_type, str):
        return None

    return payload
