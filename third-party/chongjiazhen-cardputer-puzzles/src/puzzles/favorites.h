#pragma once
#include <string>
#include <vector>

// Favourites: starred games float to the top of the chooser (Ctrl+F on the
// list). Pure ordering + the on-disk format live here so both are host-testable;
// main.cpp owns the flags and the file I/O.
namespace puz {

// Chooser display order: starred games first, then the rest, each group keeping
// the generated (alphabetical) gamelist order. Stable, so starring one game
// reshuffles nothing but that game. order[] must hold n ints.
inline void favOrder(const bool* fav, int n, int* order) {
  int k = 0;
  for (int i = 0; i < n; i++) if (fav[i])  order[k++] = i;
  for (int i = 0; i < n; i++) if (!fav[i]) order[k++] = i;
}

// Which chooser row game `idx` sits on. Falls back to the top row for an index
// that isn't in the order (can't happen with favOrder, but keeps a caller that
// hands us a stale index landing somewhere valid rather than out of bounds).
inline int favSlot(const int* order, int n, int idx) {
  for (int i = 0; i < n; i++) if (order[i] == idx) return i;
  return 0;
}

// Parse the favourites file: one slug per line. Stores SLUGS, not indices, for
// the same reason the last-played file does -- gamelist order is generated, so
// an index would silently point at a different game if the set ever changed.
// Tolerates CRLF, a missing trailing newline, and blank lines.
inline std::vector<std::string> favSlugs(const std::string& blob) {
  std::vector<std::string> out;
  std::string cur;
  for (char c : blob) {
    if (c == '\n' || c == '\r') { if (!cur.empty()) out.push_back(cur); cur.clear(); }
    else cur += c;
  }
  if (!cur.empty()) out.push_back(cur);
  return out;
}

}  // namespace puz
