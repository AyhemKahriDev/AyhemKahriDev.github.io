/* --- [Simulator] --- */
      class Simulator {
        constructor() {}
        clone(s) { return JSON.parse(JSON.stringify(s)); }
        
        findSolvableDeck() {
            const randomSeed = Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase().padStart(8, "0");
            return this.findSolvableDeckWithSeed(randomSeed).startState;
        }

        findSolvableDeckWithSeed(seed) {
            let attempts = 0;
            while (attempts < 500) {
                const deck = this.createDeckFromSeedAttempt(seed, attempts);
                const startState = this.deal(deck);
                if (this.canSolve(this.clone(startState), { limit: Config.SOLVER_LIMIT_DEAL, noProgressLimit: Config.SOLVER_STALL_DEAL })) {
                    return { startState, attemptIndex: attempts };
                }
                attempts++;
            }
            return { startState: this.deal(this.createDeckFromSeedAttempt(seed, 0)), attemptIndex: 0 };
        }

        checkCurrentState(currentState) {
            for(let i=0; i<13; i++) {
                if (this.canSolve(this.clone(currentState), { limit: Config.SOLVER_LIMIT_CHECK, noProgressLimit: Config.SOLVER_STALL_CHECK })) return true;
            }
            return false;
        }

        createDeck() {
            return this.createDeckWithRng(() => Math.random());
        }
        createDeckFromSeedAttempt(seed, attemptIndex) {
            const rng = this.rngFromSeedAttempt(seed, attemptIndex);
            return this.createDeckWithRng(rng);
        }
        createDeckWithRng(rng) {
            const d = [];
            // 【変更点2】 色の判定ロジックを変更。偶数(0,2)が黒、奇数(1,3)が赤
            for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) d.push({ suit: s, rank: r + 1, color: (s % 2 === 0) ? 0 : 1, isOpen: false });
            for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
            return d;
        }
        hashSeed(seedText) {
            let h = 2166136261;
            for (let i = 0; i < seedText.length; i++) {
                h ^= seedText.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return (h >>> 0);
        }
        rngFromSeedAttempt(seed, attemptIndex) {
            let a = this.hashSeed(`${String(seed).toUpperCase()}#${attemptIndex}`) || 0x9e3779b9;
            return () => {
                a += 0x6D2B79F5;
                let t = a;
                t = Math.imul(t ^ (t >>> 15), t | 1);
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        }
        deal(d) {
             let t = Array.from({ length: 7 }, () => []);
             const tempDeck = [...d];
             for (let i = 0; i < 7; i++) {
                 for (let j = 0; j <= i; j++) {
                     const c = tempDeck.pop(); c.isOpen = (j === i); t[i].push(c);
                 }
             }
             return { stock: tempDeck, waste: [], foundations: [[],[],[],[]], tableau: t };
        }

        canSolve(simState, opts = {}) {
            let moves = 0;
            let noProgressLoop = 0;
            const limit = (opts.limit ?? Config.SOLVER_LIMIT_CHECK);
            const noProgressLimit = (opts.noProgressLimit ?? Config.SOLVER_STALL_CHECK);
            while (moves < limit && noProgressLoop < noProgressLimit) {
                let moved = false;
                for (let i = 0; i < 7; i++) {
                    const col = simState.tableau[i];
                    if (col.length > 0) {
                        const c = col[col.length - 1];
                        if (this.checkF(simState, c, c.suit)) {
                            simState.foundations[c.suit].push(col.pop());
                            if (col.length > 0) col[col.length - 1].isOpen = true;
                            moved = true; break;
                        }
                    }
                }
                if (moved) { moves++; noProgressLoop=0; continue; }
                if (simState.waste.length > 0) {
                    const c = simState.waste[simState.waste.length - 1];
                    if (this.checkF(simState, c, c.suit)) {
                        simState.foundations[c.suit].push(simState.waste.pop());
                        moved = true;
                    }
                }
                if (moved) { moves++; noProgressLoop=0; continue; }
                for (let i = 0; i < 7; i++) {
                    const col = simState.tableau[i];
                    if (col.length === 0) continue;
                    let openIdx = -1;
                    for(let k=0; k<col.length; k++) { if(col[k].isOpen) { openIdx=k; break; } }
                    if (openIdx === -1) continue; 
                    if (openIdx === 0 && col[openIdx].rank === 13) continue;
                    const cardToMove = col[openIdx];
                    const target = this.findTabTarget(simState, cardToMove, i);
                    if (target !== -1) {
                        const run = col.splice(openIdx);
                        simState.tableau[target] = simState.tableau[target].concat(run);
                        if (col.length > 0) col[col.length - 1].isOpen = true;
                        moved = true; break;
                    }
                }
                if (moved) { moves++; noProgressLoop=0; continue; }
                if (simState.waste.length > 0) {
                    const c = simState.waste[simState.waste.length - 1];
                    const target = this.findTabTarget(simState, c, -1);
                    if (target !== -1) {
                        simState.tableau[target].push(simState.waste.pop());
                        moved = true;
                    }
                }
                if (moved) { moves++; noProgressLoop=0; continue; }
                if (simState.stock.length > 0) {
                    const c = simState.stock.pop(); c.isOpen = true;
                    simState.waste.push(c); moved = true;
                } else if (simState.stock.length === 0 && simState.waste.length > 0) {
                    simState.stock = simState.waste.reverse();
                    simState.stock.forEach(x => x.isOpen = false);
                    simState.waste = []; moved = true;
                }
                if (moved) {
                     moves++; 
                     if (simState.stock.length === 0 && simState.waste.length === 0) noProgressLoop = 0;
                     else noProgressLoop++;
                } else break;
            }
            return simState.foundations.reduce((a, b) => a + b.length, 0) === 52;
        }
        getNextMove(simState) {
            for (let i = 0; i < 7; i++) {
                const col = simState.tableau[i];
                if (col.length > 0) {
                    const c = col[col.length - 1];
                    if (this.checkF(simState, c, c.suit)) {
                        return { type: "t2f", tableauIdx: i, suit: c.suit };
                    }
                }
            }
            if (simState.waste.length > 0) {
                const c = simState.waste[simState.waste.length - 1];
                if (this.checkF(simState, c, c.suit)) {
                    return { type: "w2f", suit: c.suit };
                }
            }
            for (let i = 0; i < 7; i++) {
                const col = simState.tableau[i];
                if (col.length === 0) continue;
                let openIdx = -1;
                for (let k = 0; k < col.length; k++) { if (col[k].isOpen) { openIdx = k; break; } }
                if (openIdx === -1) continue;
                if (openIdx === 0 && col[openIdx].rank === 13) continue;
                const cardToMove = col[openIdx];
                const target = this.findTabTarget(simState, cardToMove, i);
                if (target !== -1) {
                    return { type: "t2t", fromIdx: i, toIdx: target, openIdx };
                }
            }
            if (simState.waste.length > 0) {
                const c = simState.waste[simState.waste.length - 1];
                const target = this.findTabTarget(simState, c, -1);
                if (target !== -1) {
                    return { type: "w2t", toIdx: target };
                }
            }
            if (simState.stock.length > 0) return { type: "draw" };
            if (simState.stock.length === 0 && simState.waste.length > 0) return { type: "recycle" };
            return null;
        }
        checkF(s, card, fIdx) {
            const f = s.foundations[fIdx];
            if (f.length === 0) return card.rank === 1 && card.suit === fIdx;
            const top = f[f.length - 1];
            return card.suit === top.suit && card.rank === top.rank + 1;
        }
        findTabTarget(s, card, ignoreIdx) {
            for (let i = 0; i < 7; i++) {
                if (i === ignoreIdx) continue;
                const dest = s.tableau[i];
                if (dest.length === 0) { if (card.rank === 13) return i; } 
                else {
                    const top = dest[dest.length - 1];
                    if (card.rank === top.rank - 1 && card.color !== top.color) return i;
                }
            }
            return -1;
        }
      }
      const bot = new Simulator();

      
