// bugreport_test.cpp - g++ -std=c++17 bugreport_test.cpp -o bugreport_test && ./bugreport_test
//
// A synthetic form id, deliberately not the real one: this file grades the URL
// shape and the byte budget, and both must stay true when the form is
// recreated. It is 10 chars where a Tally id is typically 6, so every capacity
// assertion below is measured with more base than the device will really carry.
//
// Whether the SHIPPED id is real is a different question and not one a host
// test can answer -- it is a property of the image, not of this source. That
// guard lives in scripts/package-release.py, against the merged binary.
#define PUZ_TALLY_FORM_ID "tsTfrmTsTf"
#include "bugreport.h"
#include <cassert>
#include <cstdio>
using namespace puz;

static bool contains(const std::string& h, const std::string& n) {
  return h.find(n) != std::string::npos;
}

int main() {
  // --- urlEncode ---
  assert(urlEncode("abcXYZ019-._~") == "abcXYZ019-._~");   // unreserved passes through
  assert(urlEncode("a b") == "a+b");                       // space -> '+', 1 char not 3
  assert(urlEncode("9x9#12") == "9x9%2312");               // '#' would truncate the URL
  assert(urlEncode("[BUG]") == "%5BBUG%5D");
  assert(urlEncode("\n") == "%0A");
  assert(urlEncode("a&b=c") == "a%26b%3Dc");               // must not open a new param

  // --- capacity ladder ---
  assert(qrVersionFor(17) == 1);
  assert(qrVersionFor(18) == 2);
  assert(qrVersionFor(192) == 8);
  assert(qrVersionFor(193) == 0);          // past the scannable ceiling
  assert(qrVersionFor(193, 10) == 9);      // ... but encodable if the ceiling is raised
  assert(kMaxQrVersion == 8);

  // --- level 1: a normal seed id fits whole ---
  {
    BugUrl b = buildBugUrl("Solo", "9x9#12345678901234567890", "v1.1.4");
    assert(b.hasId);
    assert(b.version >= 1 && b.version <= kMaxQrVersion);
    assert(b.url.size() <= (size_t)qrByteCapacity(b.version));
    assert(contains(b.url, "board=9x9%2312345678901234567890"));
    assert(contains(b.url, "game=Solo"));
    assert(contains(b.url, "fw=v1.1.4"));
    assert(b.url.rfind(formBase(), 0) == 0);
  }

  // --- the form, not the issue tracker ---
  // The device path exists to work without a GitHub account, so a URL that
  // drifted back to github.com would quietly restore the signup wall while
  // every other assertion here still passed.
  {
    BugUrl b = buildBugUrl("Solo", "9x9#1", "v1.1.4");
    assert(b.url.rfind("https://tally.so/r/", 0) == 0);
    assert(!contains(b.url, "github.com"));
    // Field names are the hidden fields' names ON the form; rename one there
    // and it stops prefilling, silently and only on the device.
    assert(contains(b.url, "?game=") && contains(b.url, "&fw=") && contains(b.url, "&board="));
  }

  // --- module size, which is what actually decides whether a phone locks on ---
  // The screen hands qrcode() a 132px box and lgfx floors thickness to
  // boxWidth/modules, so a code at version 6 (41 modules) renders 3px modules
  // and version 7 (45) renders 2px. Every real board must therefore stay inside
  // the version-6 budget; a URL change that pushes one to version 7 silently
  // shrinks the code by a third, which is the difference this test guards.
  //
  // The bound is version 5, not the version 6 the GitHub base needed: the
  // shorter form base bought a whole version of headroom, and pinning the test
  // at the old bound would let that headroom be spent again without anyone
  // noticing until a board stopped scanning on hardware.
  {
    struct { const char* game; const char* id; } kBoards[] = {
      { "Solo",         "9x9#12345678901234567890" },
      { "Train Tracks", "15x15dh#98765432109876543210" },   // longest game name
      { "Rectangles",   "20x20#98765432109876543210" },
      { "Loopy",        "12x10t11de#98765432109876543210" },
      { "Black Box",    "w15h15m5M5#98765432109876543210" },
      { "Same Game",    "20x15c6s2r#98765432109876543210" },
    };
    for (auto& t : kBoards) {
      BugUrl b = buildBugUrl(t.game, t.id, "v1.1.4");
      assert(b.hasId);
      assert(b.version <= 5);
      int modules = 17 + 4 * b.version;
      assert(132 / modules >= 3);
    }
  }

  // --- level 2: an id too long to encode is dropped, not truncated ---
  {
    std::string huge(400, 'x');
    BugUrl b = buildBugUrl("Untangle", huge, "v1.1.4");
    assert(!b.hasId);
    assert(!contains(b.url, "xxxx"));                       // no partial id at all
    assert(!contains(b.url, "board="));                     // the field is omitted, not empty
    assert(contains(b.url, "game=Untangle"));               // game still identified
    assert(b.url.size() <= (size_t)qrByteCapacity(b.version));
  }

  // --- level 3: even the title too long -> bare URL, still a valid QR ---
  {
    std::string hugeName(400, 'z');
    BugUrl b = buildBugUrl(hugeName, "9x9#1", "v1.1.4");
    assert(!b.hasId);
    assert(b.url == formBase());
    assert(b.version >= 1 && b.url.size() <= (size_t)qrByteCapacity(b.version));
  }

  // Every real game name at a plausible seed id must reach level 1 - the whole
  // feature is the id, so a name long enough to evict it is a regression.
  {
    BugUrl b = buildBugUrl("Train Tracks", "15x15dh#98765432109876543210", "v1.1.4");
    assert(b.hasId);
  }

  // --- backlight ladder ---
  {
    assert(kRepBright[kRepBrightDefault] == 32);   // the measured-good level
    // Reaches one rung below the default, so a dimmer optimum is still findable.
    assert(kRepBrightDefault > 0);
    assert(kRepBright[0] < 32);
    // ... but not below the legibility floor. The board id beside the code is
    // the fallback for a QR that won't scan, and 8 and 4 were measured too dark
    // to read, which would break that fallback to chase a scan improvement.
    assert(kRepBright[0] >= 16);
    for (int i = 1; i < kRepBrightN; i++) assert(kRepBright[i] > kRepBright[i - 1]);
    assert(kRepBright[kRepBrightN - 1] == 255);    // full brightness still reachable
    // Clamps, never wraps: stepping off the dim end into 255 mid-scan blinds
    // both the camera and the user.
    assert(repBrightStep(0, -1) == 0);
    assert(repBrightStep(kRepBrightN - 1, 1) == kRepBrightN - 1);
    assert(repBrightStep(kRepBrightDefault, -1) == kRepBrightDefault - 1);
    assert(repBrightStep(kRepBrightDefault, 1) == kRepBrightDefault + 1);
  }

  // --- urlHost: the screen's destination line ---
  // Derived from the encoded URL, never written out twice, so the label cannot
  // reassure someone about a domain the QR does not actually go to.
  {
    assert(urlHost("https://tally.so/r/abc?x=1") == "tally.so");
    assert(urlHost("https://tally.so") == "tally.so");          // no path at all
    assert(urlHost("tally.so/r/abc") == "tally.so");            // no scheme
    for (const char* id : { "9x9#1", "" }) {
      BugUrl b = buildBugUrl("Solo", id, "v1.1.4");
      assert(urlHost(b.url) == "tally.so");
    }
    // The label must fit the 14-column right gutter beside the code, arrow and
    // all -- an overflowing host would run off the panel edge unremarked.
    assert(std::string("-> ").size() + urlHost(formBase()).size() <= 14);
  }

  // --- wrapFixed: ids are one unbroken token ---
  {
    auto w = wrapFixed("abcdefghij", 4);
    assert(w.size() == 3 && w[0] == "abcd" && w[1] == "efgh" && w[2] == "ij");
    assert(wrapFixed("", 4).size() == 1);      // never returns an empty vector
    assert(wrapFixed("abc", 0).empty());       // degenerate width: no infinite loop
  }

  printf("ok\n");
  return 0;
}
