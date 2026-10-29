#!/usr/bin/env python3
"""Build the release artifacts for cardputer-puzzles, with the guards that
a hand-typed esptool command does not have.

    py -3 scripts/package-release.py            # build + assert + write dist/
    py -3 scripts/package-release.py --check    # assert only, write nothing

Produces, into dist/:
    cardputer-puzzles-<version>-app.bin     app-only, for SD launchers / OTA
    cardputer-puzzles-<version>-merged.bin  full flash at 0x0

Every check below exists because something got past its absence. Read
`~/atelier/guidelines/cardputer-fleet.md` for the incidents.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / ".pio" / "build" / "puzzles"
DIST = ROOT / "dist"
PIO_PKGS = Path.home() / ".platformio" / "packages"
ESPTOOL = PIO_PKGS / "tool-esptoolpy" / "esptool.py"
BOOT_APP0 = (PIO_PKGS / "framework-arduinoespressif32" / "tools" / "partitions"
             / "boot_app0.bin")

# offset -> source file, mirroring what `pio run -t upload` writes
SEGMENTS = [
    (0x0,     BUILD / "bootloader.bin"),
    (0x8000,  BUILD / "partitions.bin"),
    (0xE000,  BOOT_APP0),
    (0x10000, BUILD / "firmware.bin"),
]

IMAGE_MAGIC = 0xE9
PARTTABLE_MAGIC = b"\xaa\x50"


class GuardFailure(Exception):
    """A check failed. Never package past one of these."""


def fail(msg: str) -> None:
    raise GuardFailure(msg)


def read_version() -> str:
    """Single source of truth for the version is the firmware header."""
    hdr = (ROOT / "src" / "puzzles" / "frontend.h").read_text(encoding="utf-8")
    m = re.search(r'#define\s+FW_VERSION\s+"([^"]+)"', hdr)
    if not m:
        fail("FW_VERSION not found in src/puzzles/frontend.h")
    return m.group(1)


def spi_mode(blob: bytes) -> int:
    return blob[2]


def spi_speed_size(blob: bytes) -> int:
    return blob[3]


def check_sources() -> None:
    for off, path in SEGMENTS:
        if not path.is_file():
            fail(f"missing build input for 0x{off:x}: {path}\n"
                 f"       run `pio run -e puzzles` first")


BUGREPORT_H = ROOT / "src" / "puzzles" / "bugreport.h"
FORM_ID_RE = re.compile(r'^#define\s+PUZ_TALLY_FORM_ID\s+"([^"]*)"', re.M)
# Every tracked file that spells the form id out for a reader. The firmware and
# the docs pointing at different forms is its own quiet failure.
FORM_ID_DOCS = ["README.md", "CONTRIBUTING.md", "site/index.html"]


def declared_form_id() -> str:
    """The id in bugreport.h, which is the single source of truth for it."""
    m = FORM_ID_RE.search(BUGREPORT_H.read_text(encoding="utf-8"))
    if not m:
        fail(f"no PUZ_TALLY_FORM_ID #define found in {BUGREPORT_H}")
    return m.group(1)


def check_form_id() -> str:
    """The bug-report QR is the one thing here that fails silently in the
    reporter's hands: a wrong id gives a code that scans cleanly and lands on
    nothing, and the device screen cannot tell the difference. So the id is
    checked before anything is built, and again against the image below."""
    form_id = declared_form_id()
    if form_id == "PASTEID":
        fail("PUZ_TALLY_FORM_ID is still the placeholder.\n"
             "       Create the feedback form, then put its id (the <id> from\n"
             f"       https://tally.so/r/<id>) in {BUGREPORT_H.name} and in: "
             + ", ".join(FORM_ID_DOCS))

    stale = [d for d in FORM_ID_DOCS
             if f"tally.so/r/{form_id}" not in (ROOT / d).read_text(encoding="utf-8")]
    if stale:
        fail(f"these link a different form than the firmware ({form_id}): "
             + ", ".join(stale))
    return form_id


def merge(version: str, out: Path) -> None:
    """--flash_mode/--flash_freq keep: merge_bin REWRITES the bootloader header
    when given a literal mode, and the board manifest disagrees with what the
    build actually emits. Only --flash_size is allowed to rewrite (byte 3)."""
    args = [sys.executable, str(ESPTOOL), "--chip", "esp32s3", "merge_bin",
            "-o", str(out),
            "--flash_mode", "keep", "--flash_freq", "keep",
            "--flash_size", "8MB"]
    for off, path in SEGMENTS:
        args += [hex(off), str(path)]
    proc = subprocess.run(args, capture_output=True, text=True)
    if proc.returncode != 0:
        fail(f"merge_bin failed:\n{proc.stdout}\n{proc.stderr}")


def check_merged(merged: bytes, form_id: str) -> list[str]:
    """The guards. Each returns a line for the report or raises."""
    notes = []
    boot = SEGMENTS[0][1].read_bytes()
    fw = SEGMENTS[3][1].read_bytes()

    # 1. The one that cost a dead device: the merged bootloader must be the
    #    bootloader the compiler emitted, byte for byte. An independent
    #    reference -- not the merged file compared against itself.
    if merged[:len(boot)] != boot:
        got, want = spi_mode(merged), spi_mode(boot)
        fail(f"merged bootloader region != build output.\n"
             f"       merged byte2=0x{got:02X}  bootloader.bin byte2=0x{want:02X}\n"
             f"       a literal --flash_mode rewrites this; it must be `keep`")
    notes.append(f"bootloader region matches build output "
                 f"(spi_mode=0x{spi_mode(boot):02X})")

    # 2. The app header must survive the merge untouched too.
    if merged[0x10000:0x10000 + len(fw)] != fw:
        fail(f"merged app region != firmware.bin\n"
             f"       merged byte2=0x{merged[0x10002]:02X}  "
             f"firmware.bin byte2=0x{spi_mode(fw):02X}")
    notes.append(f"app region matches firmware.bin "
                 f"(spi_mode=0x{spi_mode(fw):02X})")

    # 3. Structural: the three things a bootable image must have.
    if merged[0x0] != IMAGE_MAGIC:
        fail(f"bootloader magic at 0x0 is 0x{merged[0x0]:02X}, want 0x{IMAGE_MAGIC:02X}")
    if merged[0x8000:0x8002] != PARTTABLE_MAGIC:
        fail(f"partition table magic at 0x8000 is {merged[0x8000:0x8002].hex()}, want aa50")
    if merged[0x10000] != IMAGE_MAGIC:
        fail(f"app magic at 0x10000 is 0x{merged[0x10000]:02X}, want 0x{IMAGE_MAGIC:02X}")
    notes.append("magics ok: bootloader 0x0, parttable 0x8000, app 0x10000")

    # 4. Blast radius. merge_bin pads gaps with 0xFF and write_flash erases
    #    every sector it spans, so the image destroys whatever it reaches --
    #    gaps included. A merged image is only as destructive as its highest
    #    segment. Report it rather than guess which partitions matter.
    nvs_lo, nvs_hi = 0x9000, 0xE000
    gap = merged[nvs_lo:nvs_hi]
    if gap.count(0xFF) == len(gap):
        notes.append(f"nvs 0x{nvs_lo:x}-0x{nvs_hi:x} is 0xFF padding: a full "
                     f"write_flash 0x0 ERASES nvs (split the write to spare it)")
    spiffs_off = 0x670000
    if len(merged) > spiffs_off:
        fail(f"image ends at 0x{len(merged):x}, past spiffs at 0x{spiffs_off:x}\n"
             f"       a full flash would destroy saved games")
    notes.append(f"image ends 0x{len(merged):x}, {(spiffs_off - len(merged)) / 2**20:.2f} "
                 f"MB clear of spiffs at 0x{spiffs_off:x} (.sav files safe)")

    # 5. The bug-report QR, checked against the IMAGE rather than the source
    #    that was meant to produce it. bugreport.h assembles the URL at runtime
    #    from a base and an id, so both literals sit in the binary and can be
    #    read back. Checking the source only would pass an image built with a
    #    -D override -- which is the realistic way a dead id ships, since that
    #    override exists precisely so someone can build without owning the form.
    base = b"https://tally.so/r/"
    if base not in merged:
        fail(f"{base.decode()} is not in the image: the report screen cannot "
             f"reach the form")
    if b"PASTEID" in merged:
        fail("the placeholder form id is in the image: the report QR would "
             "scan cleanly and land on nothing")
    if form_id.encode() not in merged:
        fail(f"declared form id {form_id!r} is not in the image.\n"
             f"       built with a -DPUZ_TALLY_FORM_ID override? rebuild "
             f"without one:\n       pio run -e puzzles -t clean && pio run -e puzzles")
    notes.append(f"report QR points at tally.so/r/{form_id} (read from the image)")
    return notes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="run the guards, write nothing")
    args = ap.parse_args()

    try:
        check_sources()
        form_id = check_form_id()
        version = read_version()
        DIST.mkdir(exist_ok=True)
        merged_path = DIST / f"cardputer-puzzles-{version}-merged.bin"
        app_path = DIST / f"cardputer-puzzles-{version}-app.bin"

        tmp = DIST / ".merged.tmp"
        merge(version, tmp)
        merged = tmp.read_bytes()
        notes = check_merged(merged, form_id)

        print(f"cardputer-puzzles {version}")
        for n in notes:
            print(f"  ok  {n}")

        if args.check:
            tmp.unlink()
            print("\n--check: guards passed, nothing written")
            return 0

        tmp.replace(merged_path)
        shutil.copyfile(SEGMENTS[3][1], app_path)
        for p in (merged_path, app_path):
            d = p.read_bytes()
            print(f"\n{p.name}\n  {len(d)} bytes  sha256={hashlib.sha256(d).hexdigest()}")
        return 0

    except GuardFailure as e:
        # Leave no half-built image behind for someone to publish by mistake.
        (DIST / ".merged.tmp").unlink(missing_ok=True)
        print(f"\nFAIL: {e}", file=sys.stderr)
        print("\nNo artifact written. Do not publish anything from dist/ "
              "until this passes.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
