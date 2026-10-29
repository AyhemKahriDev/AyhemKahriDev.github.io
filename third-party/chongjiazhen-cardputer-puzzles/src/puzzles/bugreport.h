#pragma once
#include <cstdint>
#include <string>
#include <vector>

// On-device bug report: build the feedback-form URL that the Tab -> "Report
// bug" screen renders as a QR code. Pure logic (no Arduino/M5GFX) so the URL
// shape, the escaping and the QR capacity arithmetic are host-testable;
// ui_screens.cpp owns the drawing.
//
// It points at a Tally form rather than this repo's new-issue page because the
// people holding the device are the least likely to have a GitHub account, and
// a report that needs a signup is a report that does not get filed. The issue
// tracker is still the tracker -- README and the site link it for anyone who
// has an account; this path just removes the account from the device flow. The
// cost is that a form response is triaged by hand into an issue, which at this
// project's volume is cheaper than the reports the signup wall loses.
//
// The point of the whole feature is the game id. "Solo crashed sometimes" is
// unactionable; a seed-form id ("9x9#1234...") regenerates the exact board on
// any build of the collection, so a report carries a repro. That id therefore
// decides the layout: it is what can push the URL past what a 240x135 panel can
// show as a scannable QR, and buildBugUrl degrades in that order -- drop the
// id before dropping the report.
namespace puz {

// The form's short id, from its share URL (https://tally.so/r/<id>). It is the
// one value here that cannot be derived from the repo, so a wrong one fails in
// the worst way available: the QR scans cleanly and lands on nothing, which
// looks exactly like success to whoever is holding the device.
//
// This line is the declared id, and scripts/package-release.py treats it as the
// truth: it refuses to package while it still reads PASTEID, and separately
// asserts this exact string is present in the merged image, so an image built
// with a -D override cannot ship either. The guard lives there rather than here
// because a compile-time hard failure blocks every build in the repo -- including
// work that never touches this screen -- to protect an artifact only the release
// step produces.
//
// A warning still fires on every compile that leaves it unset, because the
// person who flashes a dev build is the one who can see the wrong QR.
#ifndef PUZ_TALLY_FORM_ID
#define PUZ_TALLY_FORM_ID "PASTEID"
#pragma message("bugreport.h: PUZ_TALLY_FORM_ID is unset, so the report QR " \
                "points at https://tally.so/r/PASTEID, which is not a real " \
                "form. Fine for a build that ignores the report screen; " \
                "package-release.py refuses to ship it.")
#endif
inline const char* kTallyFormId = PUZ_TALLY_FORM_ID;

inline std::string formBase() {
  return std::string("https://tally.so/r/") + kTallyFormId;
}

// Percent-encode for a query-string VALUE. Space becomes '+' rather than %20:
// both decode to a space in a query string, and at 1 char against 3 it buys
// roughly a line of body text inside the QR budget below.
inline std::string urlEncode(const std::string& s) {
  static const char* hex = "0123456789ABCDEF";
  std::string out;
  for (unsigned char c : s) {
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
        (c >= '0' && c <= '9') || c == '-' || c == '.' || c == '_' || c == '~')
      out += (char)c;
    else if (c == ' ')
      out += '+';
    else { out += '%'; out += hex[c >> 4]; out += hex[c & 0x0f]; }
  }
  return out;
}

// Byte-mode capacity at ECC level L, QR versions 1..10. lgfx's qrcode() encodes
// at ecc 0 (= L) and auto-grows the version until the text fits, so this table
// is the same ladder it walks -- we walk it first only to know whether the
// result will still be SCANNABLE, which lgfx does not check.
inline int qrByteCapacity(int version) {
  static const int cap[10] = { 17, 32, 53, 78, 106, 134, 154, 192, 230, 271 };
  return (version >= 1 && version <= 10) ? cap[version - 1] : 0;
}

// Version 8 is 49 modules. Even in the widest box this panel can spare that is
// 2 physical pixels per module; version 9 (53) and 10 (57) round down to 1px,
// which no phone camera resolves. So the ceiling here is a rendering limit, not
// an encoding one -- raising it produces a QR that draws and cannot be read,
// which is worse than a shorter one.
//
// This ceiling is NOT what sets the module size, and lowering it does not make
// a code easier to scan. Module size is boxWidth/modules, floored to an integer
// by lgfx; the ceiling only decides when buildBugUrl gives up and drops the id.
// Lower it and the common case renders identically while rare boards lose the
// one field the report exists to carry. The screen buys legibility by keeping
// the URL short enough to land at version 6 (41 modules) and handing qrcode() a
// 132px box: 132/41 = 3px per module, against 110/41 = 2px before.
inline const int kMaxQrVersion = 8;

// Smallest version that holds `len` bytes, or 0 if it exceeds the ceiling.
inline int qrVersionFor(size_t len, int maxVersion = kMaxQrVersion) {
  for (int v = 1; v <= maxVersion; v++)
    if (len <= (size_t)qrByteCapacity(v)) return v;
  return 0;
}

// Host part of a URL ("https://tally.so/r/x" -> "tally.so"), for the line the
// report screen prints under its title.
//
// That line is not decoration. A QR on a handheld pointing at a domain nobody
// recognises is the exact shape of a phishing code -- github.com used to vouch
// for itself and tally.so does not -- so the screen has to say where the code
// goes before someone decides whether to tap it. It is derived from the URL
// actually encoded rather than written out a second time: a hardcoded label
// that drifted from the real destination would be worse than no label, since it
// would be reassuring and wrong.
inline std::string urlHost(const std::string& url) {
  size_t start = url.find("//");
  start = (start == std::string::npos) ? 0 : start + 2;
  size_t end = url.find('/', start);
  return url.substr(start, end == std::string::npos ? std::string::npos : end - start);
}

struct BugUrl {
  std::string url;
  int  version;   // QR version to render at (>=1; never 0 -- the bare URL always fits)
  bool hasId;     // false => the id was too long to encode; the screen must say so
};

// Build the form URL, degrading until it fits a scannable QR:
//   1. game + firmware + board id, each as its own prefilled field
//   2. game + firmware, no id  (id stays on screen for hand-copying)
//   3. bare form URL
// Never truncates the id: half a game id regenerates nothing, and a report
// carrying one would look reproducible while being useless.
//
// Every byte here is a byte of module size: the version boundaries are the
// difference between a 3px and a 2px module on this panel, so the field names
// are as short as still reads sensibly in a Tally response (`game`/`fw`/`board`
// -- these are the hidden fields' names on the form, and renaming one there
// silently stops it prefilling, so they move together).
//
// The move off the GitHub new-issue base bought 34 bytes: that base is 59 bytes
// against this one's 25, which drops the worst real board from 122 bytes to
// roughly 90. That is a whole version of headroom -- the old worst case sat
// just inside the 134-byte version-6 budget, this one lands inside version 5's
// 106 -- so ids that used to degrade now encode whole.
inline BugUrl buildBugUrl(const std::string& game, const std::string& id,
                          const std::string& fw, int maxVersion = kMaxQrVersion) {
  std::string base = formBase() + "?game=" + urlEncode(game) + "&fw=" + urlEncode(fw);
  std::string full = base + "&board=" + urlEncode(id);
  int v = qrVersionFor(full.size(), maxVersion);
  if (v) return { full, v, true };

  v = qrVersionFor(base.size(), maxVersion);
  if (v) return { base, v, false };

  std::string bare = formBase();
  v = qrVersionFor(bare.size(), maxVersion);
  if (!v) v = maxVersion;   // unreachable: the bare URL is 25 bytes
  return { bare, v, false };
}

// Backlight ladder for the report screen, dimmest first. Measured on an ADV
// against a phone camera: 32 scans notably better than 255, which is the
// overexposure case -- a camera metering a small emissive panel in a dimmer room
// clips the white modules and merges them, so past a point more light is worse.
// Hence a ladder that is dense at the BOTTOM and the default sitting near it:
// the useful resolution is down here, and a linear step would spend most of its
// range in the region that does not decode.
//
// It doubles rather than stepping because perceived brightness is roughly
// logarithmic: the useful resolution is all at the dim end, where a linear step
// would spend most of its range in the region that does not decode.
//
// The floor is 16, and it is a LEGIBILITY floor rather than a scanning one. The
// board id is printed beside the code precisely so it can be transcribed when
// the QR won't scan, so a level that renders that column unreadable destroys
// the fallback the dim end exists to protect. 8 and 4 were on this ladder and
// were measured too dark to read on an ADV; they also make an over-pressed ','
// look like a crash on a screen with no other content. The ladder still reaches
// one rung below the default, which is all the downward headroom the original
// floor-effect question needed.
inline const uint8_t kRepBright[] = { 16, 32, 64, 128, 255 };
inline const int kRepBrightN = 5;
inline const int kRepBrightDefault = 1;   // -> 32

// Step the ladder, clamping at both ends. Deliberately does NOT wrap: walking
// off the dim end into full brightness mid-scan blinds both the camera and the
// user, and there is no way to read that as anything but a bug.
inline int repBrightStep(int idx, int dir) {
  int n = idx + dir;
  if (n < 0) return 0;
  if (n >= kRepBrightN) return kRepBrightN - 1;
  return n;
}

// Hard-wrap at a fixed column. Game ids are one unbroken token (no spaces to
// break on), so word wrapping would emit a single overflowing line.
inline std::vector<std::string> wrapFixed(const std::string& s, int cols) {
  std::vector<std::string> out;
  if (cols < 1) return out;
  for (size_t i = 0; i < s.size(); i += (size_t)cols)
    out.push_back(s.substr(i, (size_t)cols));
  if (out.empty()) out.push_back("");
  return out;
}

}  // namespace puz
