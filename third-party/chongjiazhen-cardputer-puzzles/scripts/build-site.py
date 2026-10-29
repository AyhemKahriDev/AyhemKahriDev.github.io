#!/usr/bin/env python3
"""Assemble the GitHub Pages site into _site/, including a browser-flashable
firmware manifest for ESP Web Tools.

    py -3 scripts/build-site.py             # uses dist/ for the firmware
    py -3 scripts/build-site.py --no-firmware   # page only, no bins/manifest

The interesting part is the firmware split. `write_flash 0x0 <merged>` erases
every sector the image spans, gaps included, and merge_bin pads the
0x9000-0xe000 hole (the `nvs` partition) with 0xFF -- so the one-command install
wipes settings on an upgrade. The site serves the same bytes as two parts that
straddle the hole, and ESP Web Tools writes only the regions a part covers.

Guards, in the same spirit as package-release.py: every claim this script makes
about the image is checked against the image, and the split is proved by
reassembly rather than assumed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_SRC = ROOT / "site"
HERO = ROOT / "docs" / "hero.jpg"
DIST = ROOT / "dist"
OUT = ROOT / "_site"

REPO_URL = "https://github.com/chongjiazhen/cardputer-puzzles"

# Partition geometry of default_8MB.csv, as the merged image lays it out.
NVS_LO, NVS_HI = 0x9000, 0xE000     # the hole the split preserves
SPIFFS_OFF = 0x670000               # per-game .sav files live here
IMAGE_MAGIC = 0xE9
PARTTABLE_MAGIC = b"\xaa\x50"

PART_LO = "firmware-0x0.bin"        # bootloader + partition table
PART_HI = "firmware-0xe000.bin"     # otadata + app


class GuardFailure(Exception):
    """A check failed. Never publish past one of these."""


def fail(msg: str) -> None:
    raise GuardFailure(msg)


def read_version() -> str:
    """Single source of truth for the version is the firmware header."""
    hdr = (ROOT / "src" / "puzzles" / "frontend.h").read_text(encoding="utf-8")
    m = re.search(r'#define\s+FW_VERSION\s+"([^"]+)"', hdr)
    if not m:
        fail("FW_VERSION not found in src/puzzles/frontend.h")
    return m.group(1)


def check_merged(merged: bytes) -> list[str]:
    notes = []

    if len(merged) <= NVS_HI:
        fail(f"image is only 0x{len(merged):x} bytes, shorter than the app offset")

    if merged[0x0] != IMAGE_MAGIC:
        fail(f"bootloader magic at 0x0 is 0x{merged[0x0]:02X}, want 0x{IMAGE_MAGIC:02X}")
    if merged[0x8000:0x8002] != PARTTABLE_MAGIC:
        fail(f"partition table magic at 0x8000 is {merged[0x8000:0x8002].hex()}, want aa50")
    if merged[0x10000] != IMAGE_MAGIC:
        fail(f"app magic at 0x10000 is 0x{merged[0x10000]:02X}, want 0x{IMAGE_MAGIC:02X}")
    notes.append("magics ok: bootloader 0x0, parttable 0x8000, app 0x10000")

    # The split is only lossless if the region it drops carries nothing. If a
    # future partition layout puts real data here, this must fail rather than
    # silently ship a firmware with a hole in it.
    gap = merged[NVS_LO:NVS_HI]
    if gap.count(0xFF) != len(gap):
        fail(f"0x{NVS_LO:x}-0x{NVS_HI:x} is not 0xFF padding "
             f"({len(gap) - gap.count(0xFF)} non-FF bytes); the split would drop data")
    notes.append(f"nvs hole 0x{NVS_LO:x}-0x{NVS_HI:x} is padding, safe to skip")

    if len(merged) > SPIFFS_OFF:
        fail(f"image ends at 0x{len(merged):x}, past spiffs at 0x{SPIFFS_OFF:x}\n"
             f"       flashing it would destroy saved games")
    notes.append(f"image ends 0x{len(merged):x}, "
                 f"{(SPIFFS_OFF - len(merged)) / 2**20:.2f} MB clear of spiffs "
                 f"at 0x{SPIFFS_OFF:x} (.sav files safe)")
    return notes


def split(merged: bytes) -> tuple[bytes, bytes]:
    lo, hi = merged[:NVS_LO], merged[NVS_HI:]
    # Prove the split by reassembly, rather than trusting the slice arithmetic.
    rebuilt = lo + b"\xff" * (NVS_HI - NVS_LO) + hi
    if rebuilt != merged:
        fail("split parts do not reassemble into the merged image")
    return lo, hi


def write_manifest(out: Path, version: str, lo: bytes, hi: bytes) -> None:
    manifest = {
        "name": "cardputer-puzzles",
        "version": version,
        # Erasing would wipe the spiffs partition holding every saved game, and
        # the parts below already cover everything this firmware owns.
        "new_install_prompt_erase": False,
        # No wifi provisioning in this firmware; don't make users wait for it.
        "new_install_improv_wait_time": 0,
        "builds": [{
            "chipFamily": "ESP32-S3",
            "parts": [
                {"path": PART_LO, "offset": 0x0},
                {"path": PART_HI, "offset": NVS_HI},
            ],
        }],
    }
    (out / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (out / PART_LO).write_bytes(lo)
    (out / PART_HI).write_bytes(hi)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-firmware", action="store_true",
                    help="build the page only; skip the bins and manifest")
    ap.add_argument("--version", default=None,
                    help="firmware version to publish (default: FW_VERSION in "
                         "src/puzzles/frontend.h). CI passes the release tag, so "
                         "the page can never claim a version that was not released.")
    args = ap.parse_args()

    try:
        version = args.version or read_version()

        if OUT.exists():
            shutil.rmtree(OUT)
        OUT.mkdir(parents=True)

        for f in sorted(SITE_SRC.iterdir()):
            if f.is_file():
                shutil.copyfile(f, OUT / f.name)
        if not HERO.is_file():
            fail(f"missing hero image: {HERO}")
        shutil.copyfile(HERO, OUT / "hero.jpg")
        # Pages runs Jekyll by default, which drops files it considers special.
        (OUT / ".nojekyll").write_text("", encoding="utf-8")

        print(f"cardputer-puzzles {version} -> {OUT}")

        if args.no_firmware:
            print("  --no-firmware: page only, install button will 404 on manifest.json")
            return 0

        merged_path = DIST / f"cardputer-puzzles-{version}-merged.bin"
        if not merged_path.is_file():
            fail(f"missing {merged_path}\n"
                 f"       run `py -3 scripts/package-release.py`, or download the "
                 f"release asset into dist/")

        merged = merged_path.read_bytes()
        for n in check_merged(merged):
            print(f"  ok  {n}")

        lo, hi = split(merged)
        print(f"  ok  split reassembles to the merged image byte for byte")
        write_manifest(OUT, version, lo, hi)

        print(f"\n{merged_path.name}\n  {len(merged)} bytes  "
              f"sha256={hashlib.sha256(merged).hexdigest()}")
        print(f"{PART_LO}\n  {len(lo)} bytes at 0x0")
        print(f"{PART_HI}\n  {len(hi)} bytes at 0x{NVS_HI:x}")
        return 0

    except GuardFailure as e:
        if OUT.exists():
            shutil.rmtree(OUT)
        print(f"\nFAIL: {e}", file=sys.stderr)
        print("\nNo site written. Do not publish until this passes.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
