#!/usr/bin/env bash
# Build and run every host test. No device, no PlatformIO, no toolchain beyond
# gcc/g++ with C11 + C++17.
#
#   scripts/host-tests.sh            # the assertive suite
#   scripts/host-tests.sh --all      # plus drag_probe, which is slow and only prints
#   scripts/host-tests.sh smear      # one test, by name fragment
#
# Everything is compiled into a temp dir and thrown away, so the worktree stays
# clean and a failed run cannot leave a stale binary behind for the next one to
# pass on.
#
# What it does NOT cover: frontend.cpp and main.cpp are device-only (M5GFX), so
# render and input changes still need a flash and a look at the screen.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ONLY=""
WITH_PROBE=0
for arg in "$@"; do
  case "$arg" in
    --all) WITH_PROBE=1 ;;
    -*)    echo "unknown option: $arg" >&2; exit 2 ;;
    *)     ONLY="$arg" ;;
  esac
done

BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT

CFLAGS="-std=c11 -DCOMBINED -DNO_TGMATH_H -I$ROOT/upstream -I$ROOT/src/puzzles"
CXXFLAGS="-std=c++17 -DCOMBINED -DNO_TGMATH_H -I$ROOT/upstream -I$ROOT/src/puzzles"

# --- patches ---------------------------------------------------------------
# The host build compiles the same upstream sources the firmware does, so it
# needs the same patches: startgame_test's Loopy cursor cases are testing one of
# them. Same idempotent rule as apply-patches.py, which does this at build time
# for PlatformIO (that file is a SCons hook and cannot be run standalone).
for patch in "$ROOT"/patches/*.patch; do
  [ -e "$patch" ] || continue
  name="$(basename "$patch")"
  if git -C "$ROOT/upstream" apply --reverse --check "$patch" 2>/dev/null; then
    continue                                    # already applied
  fi
  if ! git -C "$ROOT/upstream" apply "$patch"; then
    echo "FAILED to apply patches/$name - upstream/ is not in a state this can build from" >&2
    exit 1
  fi
  echo "[patches] applied $name"
done

# --- upstream objects ------------------------------------------------------
# Which upstream .c files are in the build is decided in exactly one place:
# platformio.ini's build_src_filter. Deriving the list from it means this script
# cannot drift from the firmware the way a second hand-maintained list would.
# tr -d '\r' because the .ini may be checked out CRLF and the \r would ride into
# the last filename.
mapfile -t CFILES < <(grep -oE '\+<\.\./upstream/[A-Za-z0-9_-]+\.c>' platformio.ini \
                      | sed 's|+<\.\./||; s|>||' | tr -d '\r' | sort -u)
if [ "${#CFILES[@]}" -lt 40 ]; then
  echo "only ${#CFILES[@]} upstream sources found in platformio.ini - has build_src_filter changed shape?" >&2
  exit 1
fi
# Host-only addition. midend.c calls document_add_puzzle, which lives in
# printing.c. The firmware never prints, and the ESP32 link drops the reference
# with --gc-sections, so build_src_filter leaves printing.c out; a plain host
# link has no such pass and fails on the undefined symbol.
CFILES+=("upstream/printing.c")

# Only three tests link the collection; compiling 65 sources to run pointer_test
# would make the single-test form useless, which is the form you reach for while
# iterating.
NEEDS_CORE=1
CORE_OBJS=()
if [ -n "$ONLY" ]; then
  NEEDS_CORE=0
  for t in startgame_test smear_test drag_probe_test; do
    [[ "$t" == *"$ONLY"* ]] && NEEDS_CORE=1
  done
fi
if [ "$NEEDS_CORE" = 1 ]; then
  echo "compiling ${#CFILES[@]} upstream sources + gamelist.c ..."
  ( cd "$BUILD" && gcc $CFLAGS -c "${CFILES[@]/#/$ROOT/}" "$ROOT/src/puzzles/gamelist.c" ) || exit 1
  ( cd "$BUILD" && g++ $CXXFLAGS -c "$ROOT/src/puzzles/params_ui.cpp" -o params_ui.o ) || exit 1
  CORE_OBJS=("$BUILD"/*.o)
fi

FAILED=()
PASSED=()

# run <name> <timeout-seconds> <needs-core: yes|no>
run_test() {
  local name="$1" secs="$2" core="$3"
  local src="$ROOT/src/puzzles/${name}.cpp"
  [ -f "$src" ] || { echo "no such test: $name" >&2; FAILED+=("$name (missing)"); return; }
  if [ -n "$ONLY" ] && [[ "$name" != *"$ONLY"* ]]; then return; fi

  printf '=== %s ===\n' "$name"
  local bin="$BUILD/$name"
  if [ "$core" = yes ]; then
    g++ $CXXFLAGS -c "$src" -o "$BUILD/$name.o" || { FAILED+=("$name (compile)"); return; }
    g++ -std=c++17 "$BUILD/$name.o" "${CORE_OBJS[@]}" -o "$bin" -lm \
      || { FAILED+=("$name (link)"); return; }
    rm -f "$BUILD/$name.o"
  else
    g++ -std=c++17 -I"$ROOT/src/puzzles" "$src" -o "$bin" || { FAILED+=("$name (compile)"); return; }
  fi

  if timeout "$secs" "$bin"; then
    PASSED+=("$name")
  else
    local rc=$?
    [ "$rc" = 124 ] && echo "(timed out after ${secs}s)"
    FAILED+=("$name")
  fi
}

run_test input_test      30 no
run_test pointer_test    30 no
run_test logic_test      30 no
run_test bugreport_test  30 no
run_test startgame_test 120 yes
run_test smear_test     300 yes
[ "$WITH_PROBE" = 1 ] && run_test drag_probe_test 600 yes

echo
# A name that matches nothing must not report success: "0/0 passed" reads exactly
# like a green run, and a typo'd filter is the easiest way to believe a suite ran.
if [ "${#PASSED[@]}" -eq 0 ] && [ "${#FAILED[@]}" -eq 0 ]; then
  echo "no test matched '$ONLY' - nothing ran" >&2
  exit 2
fi
if [ "${#FAILED[@]}" -eq 0 ]; then
  echo "host tests: ${#PASSED[@]}/${#PASSED[@]} passed (${PASSED[*]})"
  exit 0
fi
echo "host tests: ${#PASSED[@]} passed, ${#FAILED[@]} FAILED (${FAILED[*]})"
exit 1
