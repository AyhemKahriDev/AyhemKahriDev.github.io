import { describe, expect, it } from "vitest";
import { loadRulesModule } from "./helpers/load-core";

function card(suit: number, rank: number, isOpen = true) {
  return { suit, rank, color: suit % 2 === 0 ? 0 : 1, isOpen };
}

describe("rules core", () => {
  it("checks foundation and tableau placement consistently", () => {
    const state = {
      current: {
        foundations: [[card(0, 1)], [], [], []],
        tableau: [
          [card(0, 7)],
          [],
          [],
          [],
          [],
          [],
          []
        ]
      }
    };
    const config = {
      SUITS: ["spades", "hearts", "clubs", "diamonds"],
      RANKS: ["ace", "2", "3", "4", "5", "6", "7", "8", "9", "ten", "jack", "queen", "king"]
    };

    const { Rules } = loadRulesModule({ State: state, Config: config });

    expect(Rules.checkFoundationMove(card(0, 2), 0).ok).toBe(true);
    expect(Rules.checkFoundationMove(card(1, 2), 0).ok).toBe(false);

    expect(Rules.canPlaceOnTableau(card(1, 6), 0)).toEqual({ ok: true, type: "Run" });
    expect(Rules.canPlaceOnTableau(card(0, 13), 1)).toEqual({ ok: true, type: "K-only" });
    expect(Rules.canPlaceOnTableau(card(0, 6), 0).ok).toBe(false);
  });
});
