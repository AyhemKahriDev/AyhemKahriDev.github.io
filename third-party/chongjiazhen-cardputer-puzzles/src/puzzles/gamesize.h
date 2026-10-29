#pragma once
#include <string>
#include <vector>

// Remembered per-game size: the params string the player last applied from the
// Tab -> Type / Custom screens, so a game whose save is gone regenerates at the
// size they chose rather than the shipped preset in presets.h.
//
// A resumed .sav already carries params (midend_serialise stores them), so this
// only covers the fresh-generate path: first run of a game after a size change
// on another board, a save dropped as corrupt, a deleted file.
//
// On-disk format is `slug=params`, one per line -- same slug-keyed, hand-editable
// shape as favs / last / settings. Slugs, not indices: gamelist order is
// generated, so an index would silently point at a different game if the set
// changed. Model + format live here so both are host-testable; main.cpp owns the
// file I/O.
namespace puz {

struct GameSize { std::string slug, params; };

// A params string is what encode_params(full) emits: no '=' (our separator), and
// crucially no '#' or ':', which are the game-id separators for a seed and a
// board description. Storing a full game id here would pin every fresh generate
// to the same board forever, so reject one rather than replay it.
inline bool validSizeParams(const std::string& p) {
  if (p.empty()) return false;
  for (char c : p)
    if (c == '=' || c == '#' || c == ':' || c == '\n' || c == '\r' || c == ' ') return false;
  return true;
}

// Tolerant parser: CRLF, blank lines, a missing trailing newline, and a line
// that isn't `slug=params` are all skipped rather than throwing the file away --
// one bad row must not cost the player every other game's size.
inline std::vector<GameSize> parseSizes(const std::string& blob) {
  std::vector<GameSize> out;
  std::string line;
  size_t i = 0;
  while (i <= blob.size()) {
    char c = (i < blob.size()) ? blob[i] : '\n';
    i++;
    if (c != '\n' && c != '\r') { line += c; continue; }
    size_t eq = line.find('=');
    if (eq != std::string::npos && eq > 0) {
      std::string slug = line.substr(0, eq), params = line.substr(eq + 1);
      if (validSizeParams(params)) {
        bool dup = false;                      // last row wins, no duplicate keys on disk
        for (auto& e : out) if (e.slug == slug) { e.params = params; dup = true; break; }
        if (!dup) out.push_back(GameSize{ slug, params });
      }
    }
    line.clear();
  }
  return out;
}

inline std::string serializeSizes(const std::vector<GameSize>& v) {
  std::string blob;
  for (const auto& e : v)
    if (!e.slug.empty() && validSizeParams(e.params)) blob += e.slug + "=" + e.params + "\n";
  return blob;
}

// Remembered params for `slug`, or nullptr for a game the player never resized
// (the caller then keeps presets.h / the upstream default).
inline const char* sizeFor(const std::vector<GameSize>& v, const std::string& slug) {
  for (const auto& e : v) if (e.slug == slug) return e.params.c_str();
  return nullptr;
}

// Record a choice. Returns false (and changes nothing) when the value is already
// stored or isn't a params string, so the caller can skip the write.
inline bool setSize(std::vector<GameSize>& v, const std::string& slug, const std::string& params) {
  if (slug.empty() || !validSizeParams(params)) return false;
  for (auto& e : v) {
    if (e.slug != slug) continue;
    if (e.params == params) return false;
    e.params = params;
    return true;
  }
  v.push_back(GameSize{ slug, params });
  return true;
}

}  // namespace puz
