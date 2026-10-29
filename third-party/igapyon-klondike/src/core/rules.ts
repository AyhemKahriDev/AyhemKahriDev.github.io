/* --- [Rules] --- */
      function isSafeToAutoMove(card) {
        const state = State.current;
        if (card.rank === 1) return true; 
        const targetRank = card.rank - 1;
        const otherColor = 1 - card.color;
        let count = 0;
        state.foundations.forEach((f, idx) => {
            // 【変更点3】 色判定ロジックの修正 (0=S黒, 1=H赤, 2=C黒, 3=D赤)
            const fColor = (idx % 2 === 0) ? 0 : 1;
            if (fColor === otherColor) {
                const top = f[f.length - 1];
                if (top && top.rank >= targetRank) count++;
            }
        });
        return count === 2; 
      }
      function getCid(card) {
        if (!card || !card.isOpen) return "back"; 
        return `${Config.RANKS[card.rank - 1]}-of-${Config.SUITS[card.suit]}`;
      }
      function getCardKey(card) { return `${card.suit}-${card.rank}`; }
      function snapshotCard(card) {
        if (!card) return null;
        return { suit: card.suit, rank: card.rank, color: card.color, isOpen: card.isOpen };
      }
      function checkFoundationMove(card, fIdx) {
        const found = State.current.foundations[fIdx];
        if (found.length === 0) return { ok: (card.rank === 1 && card.suit === fIdx) };
        const top = found[found.length - 1];
        return { ok: (card.suit === top.suit && card.rank === top.rank + 1) };
      }
      function canPlaceOnTableau(card, tIdx) {
        const dest = State.current.tableau[tIdx];
        if (dest.length === 0) return { ok: (card.rank === 13), type: "K-only" };
        const top = dest[dest.length - 1];
        const match = top.isOpen && (card.rank === top.rank - 1) && (card.color !== top.color);
        return match ? { ok: true, type: "Run" } : { ok: false };
      }
      const Rules = { isSafeToAutoMove, getCid, checkFoundationMove, canPlaceOnTableau };

      