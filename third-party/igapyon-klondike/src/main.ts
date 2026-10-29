      /* --- [Config] --- */
      const Config = {
        APP_VERSION: "v20260305",
        // 【変更点1】 並び順を スペード(0), ハート(1), クラブ(2), ダイヤ(3) に変更
        SUITS: ["spades", "hearts", "clubs", "diamonds"],
        RANKS: ["ace", "2", "3", "4", "5", "6", "7", "8", "9", "ten", "jack", "queen", "king"],
        CLICK_DELAY_MS: 120,
        SOLVER_LIMIT_DEAL: 1000,
        SOLVER_STALL_DEAL: 13,
        SOLVER_LIMIT_CHECK: 1000,
        SOLVER_STALL_CHECK: 200,
        ANIM_MS: { manual: 260, auto: 340, draw: 200 },
        ANIM_SPEED_PX_PER_MS: { manual: 0.7, auto: 0.8, draw: 0.8 },
        ANIM_GEARUP: { startAt: 3, step: 0.5, maxMultiplier: 6.0 },
        ANIM_MIN_MS: 600,
        ANIM_MAX_MS: 2000,
        ANIM_EASE_MANUAL: "cubic-bezier(0.45, 0.85, 0.3, 1)",
        ANIM_EASE_AUTO: "cubic-bezier(0.9, 0, 0.1, 1)",
        ANIM_STAGGER_MS: 0,
        REVEAL_DELAY_MS: 0,
        ANIM_END_BUFFER_MS: 160,
        REVEAL_TO_MOVE_DELAY_MS: 0
      };

      /* --- [State] --- */
      const State = {
        current: null,
        initial: null,
        history: [],
        moveCountHistory: [],
        manualMoveCount: 0,
        startSeed: null,
        startAttemptIndex: 0,
        isAutoFinishing: false,
        isAutoMoving: false,
        isAnimating: false,
        animatingCount: 0,
        lastAnimationPromise: Promise.resolve(),
        lastAnimationEndAt: 0,
        lastRevealPromise: Promise.resolve(),
        lastMove: null,
        autoChainCount: 0,
        maxAutoChainCount: 0
      };

      document.getElementById("app-version").textContent = `${Config.APP_VERSION}`;
      function updateMoveCounter() {
        const el = document.getElementById("moves-msg");
        if (el) el.textContent = `Hands: ${State.manualMoveCount}`;
      }
      function incrementMoveCount() {
        State.manualMoveCount += 1;
        updateMoveCounter();
      }
      function makeStartKey(seed, attemptIndex) {
        return `${String(seed).toUpperCase()}-${String(attemptIndex).padStart(4, "0")}`;
      }
      function parseStartKey(input) {
        if (!input) return null;
        const m = String(input).trim().match(/^([0-9A-Fa-f]{8})-(\d{1,4})$/);
        if (!m) return null;
        return { seed: m[1].toUpperCase(), attemptIndex: Number.parseInt(m[2], 10) };
      }
      function applyStartState(state, seed, attemptIndex) {
        State.current = state;
        State.initial = JSON.parse(JSON.stringify(state));
        State.history = [];
        State.moveCountHistory = [];
        State.manualMoveCount = 0;
        State.maxAutoChainCount = 0;
        State.startSeed = seed;
        State.startAttemptIndex = attemptIndex;
        State.isAutoFinishing = false;
        State.isAutoMoving = false;
        State.autoChainCount = 0;
        clearStatus();
        setLastMove("deal", { animate: false });
        updateMoveCounter();
        updateWinStats();
        hideStartKeyFallback();
        UI.render(State.current);
        updateButtons();
        requestAutoCheck();
        Persistence.saveCurrentProgress();
      }
      function updateWinStats() {
        const handsEl = document.getElementById("win-hands");
        if (handsEl) handsEl.textContent = `Hands: ${State.manualMoveCount}`;
        const chainEl = document.getElementById("win-max-chain");
        if (chainEl) chainEl.textContent = `Max Chain: ${State.maxAutoChainCount}`;
        const startKeyEl = document.getElementById("win-startkey-value");
        if (startKeyEl) {
          if (State.startSeed) {
            startKeyEl.textContent = makeStartKey(State.startSeed, State.startAttemptIndex || 0);
          } else {
            startKeyEl.textContent = "-";
          }
        }
        const startKeyInput = document.getElementById("win-startkey-input");
        if (startKeyInput) {
          startKeyInput.value = buildWinCopyText();
        }
      }
      function buildWinCopyText() {
        const key = State.startSeed
          ? makeStartKey(State.startSeed, State.startAttemptIndex || 0)
          : "-";
        return `StartKey: ${key} | Hands: ${State.manualMoveCount} | Max Chain: ${State.maxAutoChainCount}`;
      }
      function hideStartKeyFallback() {
        const fallback = document.getElementById("win-startkey-fallback");
        if (fallback) fallback.hidden = true;
      }
      function selectStartKeyInput() {
        const input = document.getElementById("win-startkey-input");
        if (!input) return false;
        input.focus();
        input.select();
        if (typeof input.setSelectionRange === "function") {
          input.setSelectionRange(0, input.value.length);
        }
        return true;
      }
      function showStartKeyFallback(key) {
        const fallback = document.getElementById("win-startkey-fallback");
        const input = document.getElementById("win-startkey-input");
        if (!fallback || !input) {
          prompt("Copy StartKey", key);
          return;
        }
        input.value = key;
        fallback.hidden = false;
        selectStartKeyInput();
        showStatus("Long-press StartKey to copy", "#ffff00");
      }
      function tryLegacyCopy(text) {
        try {
          const area = document.createElement("textarea");
          area.value = text;
          area.setAttribute("readonly", "");
          area.style.position = "fixed";
          area.style.top = "-9999px";
          area.style.left = "-9999px";
          document.body.appendChild(area);
          area.focus();
          area.select();
          if (typeof area.setSelectionRange === "function") area.setSelectionRange(0, area.value.length);
          const ok = !!(document.execCommand && document.execCommand("copy"));
          document.body.removeChild(area);
          return ok;
        } catch (e) {
          return false;
        }
      }
      updateMoveCounter();
      updateWinStats();

      /* --- [Persistence] --- */
      const Persistence = (() => {
        const SCHEMA_VERSION = 1;
        const KEY_PREFIX = "klondike:save";

        function getVariant() {
          const name = (location.pathname.split("/").pop() || "").toLowerCase();
          return name.includes("online") ? "online" : "offline";
        }

        function getPrimaryKey() {
          return `${KEY_PREFIX}:${getVariant()}:v${SCHEMA_VERSION}`;
        }

        function getLegacyKeys() {
          const variant = getVariant();
          const common = ["klondike:save", "klondike-save"];
          if (variant === "online") {
            return [
              ...common,
              "klondike:save:index-online.html",
              "klondike-save:index-online.html",
              "klondike-save-online"
            ];
          }
          return [
            ...common,
            "klondike:save:index.html",
            "klondike:save:index-noanime.html",
            "klondike-save:index.html",
            "klondike-save:index-noanime.html",
            "klondike-save-offline"
          ];
        }

        function storageAvailable() {
          try {
            const key = "__klondike_storage_test__";
            localStorage.setItem(key, "1");
            localStorage.removeItem(key);
            return true;
          } catch (e) {
            return false;
          }
        }

        function removeKey(key) {
          try { localStorage.removeItem(key); } catch (e) {}
        }

        function migrateLegacyIfNeeded(primaryKey) {
          let exists = null;
          try { exists = localStorage.getItem(primaryKey); } catch (e) { return; }
          if (exists !== null) return;
          const keys = getLegacyKeys();
          for (const legacyKey of keys) {
            let value = null;
            try { value = localStorage.getItem(legacyKey); } catch (e) { return; }
            if (value === null) continue;
            try {
              localStorage.setItem(primaryKey, value);
              localStorage.removeItem(legacyKey);
            } catch (e) {}
            break;
          }
        }

        function isCard(card) {
          return !!card
            && Number.isInteger(card.suit) && card.suit >= 0 && card.suit <= 3
            && Number.isInteger(card.rank) && card.rank >= 1 && card.rank <= 13
            && Number.isInteger(card.color) && (card.color === 0 || card.color === 1)
            && typeof card.isOpen === "boolean";
        }

        function isCardArray(cards) {
          return Array.isArray(cards) && cards.every(isCard);
        }

        function isBoardState(state) {
          if (!state || typeof state !== "object") return false;
          if (!isCardArray(state.stock) || !isCardArray(state.waste)) return false;
          if (!Array.isArray(state.foundations) || state.foundations.length !== 4) return false;
          if (!Array.isArray(state.tableau) || state.tableau.length !== 7) return false;
          if (!state.foundations.every(isCardArray)) return false;
          if (!state.tableau.every(isCardArray)) return false;
          return true;
        }

        function isHistory(history) {
          if (!Array.isArray(history)) return false;
          for (const item of history) {
            if (typeof item !== "string") return false;
            let parsed = null;
            try { parsed = JSON.parse(item); } catch (e) { return false; }
            if (!isBoardState(parsed)) return false;
          }
          return true;
        }
        function isMoveCountHistory(history) {
          return Array.isArray(history) && history.every(x => Number.isInteger(x) && x >= 0);
        }

        function readToggleState() {
          const chk = document.getElementById("chk-autocheck");
          return { autoCheck: !!(chk && chk.checked) };
        }

        function applyToggles(toggles) {
          const chk = document.getElementById("chk-autocheck");
          if (!chk || !toggles || typeof toggles !== "object") return;
          if (typeof toggles.autoCheck === "boolean") chk.checked = toggles.autoCheck;
        }

        function buildSnapshot() {
          return {
            schemaVersion: SCHEMA_VERSION,
            appVersion: Config.APP_VERSION,
            variant: getVariant(),
            savedAt: new Date().toISOString(),
            state: {
              current: State.current,
              initial: State.initial,
              history: State.history,
              manualMoveCount: State.manualMoveCount,
              moveCountHistory: State.moveCountHistory,
              maxAutoChainCount: State.maxAutoChainCount,
              startSeed: State.startSeed,
              startAttemptIndex: State.startAttemptIndex,
              toggles: readToggleState()
            }
          };
        }

        function saveCurrentProgress() {
          if (!storageAvailable()) return;
          if (!State.current || !State.initial) return;
          const key = getPrimaryKey();
          const payload = buildSnapshot();
          try {
            localStorage.setItem(key, JSON.stringify(payload));
          } catch (e) {}
        }

        function restoreFromLocal() {
          if (!storageAvailable()) return false;
          const key = getPrimaryKey();
          migrateLegacyIfNeeded(key);

          let raw = null;
          try { raw = localStorage.getItem(key); } catch (e) { return false; }
          if (!raw) return false;

          let parsed = null;
          try { parsed = JSON.parse(raw); } catch (e) { removeKey(key); return false; }
          if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || !parsed.state) { removeKey(key); return false; }

          const s = parsed.state;
          if (!isBoardState(s.current) || !isBoardState(s.initial) || !isHistory(s.history)) {
            removeKey(key);
            return false;
          }

          State.current = s.current;
          State.initial = s.initial;
          State.history = s.history;
          if (Number.isInteger(s.manualMoveCount) && s.manualMoveCount >= 0) State.manualMoveCount = s.manualMoveCount;
          else State.manualMoveCount = 0;
          if (isMoveCountHistory(s.moveCountHistory)) State.moveCountHistory = s.moveCountHistory;
          else State.moveCountHistory = Array(State.history.length).fill(0);
          if (Number.isInteger(s.maxAutoChainCount) && s.maxAutoChainCount >= 0) State.maxAutoChainCount = s.maxAutoChainCount;
          else State.maxAutoChainCount = 0;
          if (typeof s.startSeed === "string" && /^[0-9A-Fa-f]{8}$/.test(s.startSeed)) State.startSeed = s.startSeed.toUpperCase();
          else State.startSeed = null;
          if (Number.isInteger(s.startAttemptIndex) && s.startAttemptIndex >= 0) State.startAttemptIndex = s.startAttemptIndex;
          else State.startAttemptIndex = 0;
          State.isAutoFinishing = false;
          State.isAutoMoving = false;
          State.isAnimating = false;
          State.animatingCount = 0;
          State.lastAnimationPromise = Promise.resolve();
          State.lastRevealPromise = Promise.resolve();
          State.lastAnimationEndAt = 0;
          State.autoChainCount = 0;
          applyToggles(s.toggles || {});
          setLastMove("deal", { animate: false });
          UI.render(State.current);
          updateMoveCounter();
          updateWinStats();
          updateButtons();
          clearStatus();
          requestAutoCheck();
          return true;
        }

        return {
          saveCurrentProgress,
          restoreFromLocal
        };
      })();

      /* --- [Core Modules] --- */
      // Provided by src/core/solver.ts and src/core/rules.ts.

      /* --- [Controller] --- */
      function pushHistory() {
        if (State.current) {
            if (State.history.length > 1000) State.history.shift(); 
            if (State.moveCountHistory.length > 1000) State.moveCountHistory.shift();
            State.history.push(JSON.stringify(State.current));
            State.moveCountHistory.push(State.manualMoveCount);
            updateButtons();
        }
      }
      
      function popHistory() {
        if (State.isAutoMoving || State.isAnimating) return;
        if (State.history.length === 0) return;
        State.current = JSON.parse(State.history.pop());
        const prevCount = State.moveCountHistory.pop();
        State.manualMoveCount = Number.isInteger(prevCount) ? prevCount : 0;
        State.autoChainCount = 0;
        setLastMove("manual");
        updateMoveCounter();
        UI.render(State.current); updateButtons(); requestAutoCheck();
        Persistence.saveCurrentProgress();
      }
      
      function updateButtons() { 
        document.getElementById("btn-undo").disabled = (State.history.length === 0);
        document.getElementById("btn-restart").disabled = (State.initial === null);
      }
      function showStatus(msg, color="#ffff00") {
        const el = document.getElementById("status-msg");
        el.textContent = msg; el.style.color = color;
      }
      function clearStatus() { document.getElementById("status-msg").textContent = ""; hideWarning(); }
      function showWarning() { document.getElementById("stuck-warning").style.opacity = "1"; }
      function hideWarning() { document.getElementById("stuck-warning").style.opacity = "0"; }
      function setLastMove(type, options = {}) { State.lastMove = { type, ...options }; }
      function requestAutoCheck() {
        const isCheckEnabled = document.getElementById("chk-autocheck").checked;
        if (!isCheckEnabled) return;
        Promise.all([State.lastAnimationPromise, State.lastRevealPromise]).then(() => {
          if (State.isAutoMoving || State.isAutoFinishing || State.isAnimating) return;
          performAutoCheck();
        });
      }
      function scheduleReveal(card, moveType, onDone, endAt) {
        if (!card) { if (onDone) onDone(); return; }
        const key = getCardKey(card);
        const delayMs = Config.REVEAL_DELAY_MS;
        const waitMs = Math.max(0, (endAt || performance.now()) - performance.now());
        State.lastRevealPromise = new Promise(resolve => {
          setTimeout(() => {
            if (!card.isOpen) {
              card.isOpen = true;
              const el = document.querySelector(`playing-card[data-key="${key}"]`);
              if (el) {
                el.setAttribute("cid", Rules.getCid(card));
              } else {
                setLastMove("manual", { animate: false });
                UI.render(State.current);
              }
            }
            if (onDone) setTimeout(onDone, Config.REVEAL_TO_MOVE_DELAY_MS);
            resolve();
          }, waitMs + delayMs);
        });
      }
      function waitForAnimationsThen(callback) {
        State.lastAnimationPromise.then(callback);
      }
      
      async function performAutoCheck() {
        const isCheckEnabled = document.getElementById("chk-autocheck").checked;
        if (!isCheckEnabled || State.isAutoFinishing || !State.current) { clearStatus(); return; }
        
        showStatus("Chk...", "#ccc");
        await new Promise(r => setTimeout(r, 20));
        
        const isWinnable = bot.checkCurrentState(State.current);
        
        // --- Full Debug Log (Restored) ---
        console.clear();
        console.group("%c[DEBUG] Game Status", "color: orange; font-weight: bold; font-size: 12px;");
        console.log(`%cWinnable: ${isWinnable ? "YES" : "NO"}`, isWinnable ? "color: green; font-weight:bold" : "color: red; font-weight:bold");
        console.log("Stock:", JSON.parse(JSON.stringify(State.current.stock)));
        console.log("Waste:", JSON.parse(JSON.stringify(State.current.waste)));
        console.log("Tableau:", JSON.parse(JSON.stringify(State.current.tableau)));
        console.log("Foundations:", JSON.parse(JSON.stringify(State.current.foundations)));
        console.groupEnd();
        // --------------------------------

        if (isWinnable) { showStatus("OK", "#00ff00"); hideWarning(); }
        else { showStatus("STUCK?", "#ff5555"); showWarning(); }
      }

      async function startNewGame() {
        if (State.isAutoMoving || State.isAnimating) return;
        showStatus("Gen...");
        const btnNew = document.getElementById("new-game");
        btnNew.disabled = true;
        await new Promise(r => setTimeout(r, 50)); 
        const seed = Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase().padStart(8, "0");
        const solved = bot.findSolvableDeckWithSeed(seed);
        btnNew.disabled = false;
        applyStartState(solved.startState, seed, solved.attemptIndex);
      }

      function buildTestState() {
        const tableau = Array.from({ length: 7 }, () => []);
        for (let s = 0; s < 4; s++) {
          const col = [];
          for (let r = 13; r >= 1; r--) {
            col.push({ suit: s, rank: r, color: (s % 2 === 0) ? 0 : 1, isOpen: r === 1 });
          }
          tableau[s] = col;
        }
        return { stock: [], waste: [], foundations: [[], [], [], []], tableau };
      }

      function startTestGame() {
        if (State.isAutoMoving || State.isAnimating) return;
        showStatus("Test...");
        const testState = buildTestState();
        State.current = testState;
        State.initial = JSON.parse(JSON.stringify(testState));
        State.history = [];
        State.moveCountHistory = [];
        State.manualMoveCount = 0;
        State.maxAutoChainCount = 0;
        State.startSeed = null;
        State.startAttemptIndex = 0;
        State.isAutoFinishing = false;
        State.isAutoMoving = false;
        State.autoChainCount = 0;
        clearStatus();
        setLastMove("deal", { animate: false });
        updateMoveCounter();
        updateWinStats();
        UI.render(State.current); updateButtons(); requestAutoCheck();
        checkVictoryCondition();
      }

      function restartGame() {
        if (State.isAutoMoving || State.isAnimating) return;
        if (!State.initial) return;
        if(confirm("Restart from the beginning?")) {
            State.current = JSON.parse(JSON.stringify(State.initial));
            State.history = [];
            State.moveCountHistory = [];
            State.manualMoveCount = 0;
            State.maxAutoChainCount = 0;
            State.isAutoFinishing = false;
            State.isAutoMoving = false;
            State.autoChainCount = 0;
            clearStatus();
            setLastMove("deal", { animate: false });
            updateMoveCounter();
            updateWinStats();
            UI.render(State.current); updateButtons(); requestAutoCheck();
            Persistence.saveCurrentProgress();
        }
      }

      function triggerAutoFoundation(immediate = false) {
        if (State.isAutoFinishing) return;
        const scanAndMove = () => {
          const state = State.current;
          let moved = false;
          let revealCard = null;
          let prevFoundationCard = null;
          let foundationIdx = null;
          for (let i = 0; i < 7; i++) {
            const col = state.tableau[i];
            if (col.length > 0) {
              const card = col[col.length - 1];
              if (Rules.checkFoundationMove(card, card.suit).ok && Rules.isSafeToAutoMove(card)) {
                const prev = state.foundations[card.suit];
                prevFoundationCard = prev.length > 0 ? snapshotCard(prev[prev.length - 1]) : null;
                foundationIdx = card.suit;
                state.foundations[card.suit].push(col.pop());
                if (col.length > 0 && !col[col.length - 1].isOpen) {
                  revealCard = col[col.length - 1];
                }
                moved = true; break; 
              }
            }
          }
          if (!moved && state.waste.length > 0) {
            const card = state.waste[state.waste.length - 1];
            if (Rules.checkFoundationMove(card, card.suit).ok && Rules.isSafeToAutoMove(card)) {
              const prev = state.foundations[card.suit];
              prevFoundationCard = prev.length > 0 ? snapshotCard(prev[prev.length - 1]) : null;
              foundationIdx = card.suit;
              state.foundations[card.suit].push(state.waste.pop());
              moved = true;
            }
            }
          if (moved) { 
              State.isAutoMoving = true;
              State.autoChainCount += 1;
              State.maxAutoChainCount = Math.max(State.maxAutoChainCount, State.autoChainCount);
              setLastMove("auto", { foundationIdx, prevFoundationCard });
              UI.render(State.current);
              const endAt = State.lastAnimationEndAt;
              const nextStep = () => waitForAnimationsThen(() => { setTimeout(triggerAutoFoundation, 80, true); });
              if (revealCard) scheduleReveal(revealCard, "auto", nextStep, endAt);
              else nextStep();
          } else {
              State.isAutoMoving = false;
              State.autoChainCount = 0;
              checkVictoryCondition();
              Persistence.saveCurrentProgress();
              requestAutoCheck();
          }
        };
        if (immediate) scanAndMove();
        else setTimeout(scanAndMove, 800);
      }

      function handleStockClick() {
        if (State.isAutoFinishing || State.isAutoMoving || State.isAnimating) return;
        clearStatus();
        pushHistory();
        const state = State.current;
        if (state.stock.length === 0) {
          state.stock = state.waste.reverse(); state.stock.forEach(c => c.isOpen = false); state.waste = [];
          State.autoChainCount = 0;
          setLastMove("manual", { animate: false });
        } else {
          const prevWasteTop = state.waste.length > 0 ? snapshotCard(state.waste[state.waste.length - 1]) : null;
          const c = state.stock.pop(); c.isOpen = true; state.waste.push(c);
          State.autoChainCount = 0;
          setLastMove("draw", { cardKey: getCardKey(c), prevWasteCard: prevWasteTop });
        }
        incrementMoveCount();
        UI.render(State.current); triggerAutoFoundation();
      }

      function hintMove() {
        if (State.isAutoFinishing || State.isAutoMoving || State.isAnimating) return;
        if (!State.current) return;
        clearStatus();
        const state = State.current;
        const move = bot.getNextMove(state);
        if (!move) { showStatus("NO MOVE", "#ff5555"); return; }
        pushHistory();
        let revealCard = null;
        let prevFoundationCard = null;
        let foundationIdx = null;
        if (move.type === "t2f") {
          const col = state.tableau[move.tableauIdx];
          const prev = state.foundations[move.suit];
          prevFoundationCard = prev.length > 0 ? snapshotCard(prev[prev.length - 1]) : null;
          foundationIdx = move.suit;
          state.foundations[move.suit].push(col.pop());
          if (col.length > 0 && !col[col.length - 1].isOpen) revealCard = col[col.length - 1];
          setLastMove("auto", { foundationIdx, prevFoundationCard });
        } else if (move.type === "w2f") {
          const prev = state.foundations[move.suit];
          prevFoundationCard = prev.length > 0 ? snapshotCard(prev[prev.length - 1]) : null;
          foundationIdx = move.suit;
          state.foundations[move.suit].push(state.waste.pop());
          setLastMove("auto", { foundationIdx, prevFoundationCard });
        } else if (move.type === "t2t") {
          const col = state.tableau[move.fromIdx];
          const run = col.splice(move.openIdx);
          state.tableau[move.toIdx] = state.tableau[move.toIdx].concat(run);
          if (col.length > 0 && !col[col.length - 1].isOpen) revealCard = col[col.length - 1];
          setLastMove("auto");
        } else if (move.type === "w2t") {
          state.tableau[move.toIdx].push(state.waste.pop());
          setLastMove("auto");
        } else if (move.type === "draw") {
          const prevWasteTop = state.waste.length > 0 ? snapshotCard(state.waste[state.waste.length - 1]) : null;
          const c = state.stock.pop(); c.isOpen = true; state.waste.push(c);
          setLastMove("draw", { cardKey: getCardKey(c), prevWasteCard: prevWasteTop });
        } else if (move.type === "recycle") {
          state.stock = state.waste.reverse();
          state.stock.forEach(c => c.isOpen = false);
          state.waste = [];
          setLastMove("manual", { animate: false });
        }
        incrementMoveCount();
        State.autoChainCount = 0;
        UI.render(State.current);
        const endAt = State.lastAnimationEndAt;
        const afterReveal = () => { triggerAutoFoundation(); requestAutoCheck(); };
        if (revealCard) scheduleReveal(revealCard, "auto", afterReveal, endAt);
        else waitForAnimationsThen(afterReveal);
      }

      // --- [Event Delegation Click Handler] ---
      function handleSlotClick(type, idx, mode = "single", specificCardIdx = -1) {
        if (State.isAutoFinishing || State.isAutoMoving || State.isAnimating) return;
        clearStatus();
        const state = State.current;
        let sourceArray, cardIdx;
        
        if (type === 'waste') {
            if (state.waste.length === 0) return;
            sourceArray = state.waste; 
            cardIdx = sourceArray.length - 1; 
        } else {
            sourceArray = state.tableau[idx]; 
            if (sourceArray.length === 0 && specificCardIdx === -1) return;
            if (specificCardIdx !== -1) cardIdx = specificCardIdx;
            else cardIdx = sourceArray.length - 1;
            if (!sourceArray[cardIdx].isOpen) return;
        }

        const card = sourceArray[cardIdx];
        const run = sourceArray.slice(cardIdx);
        const isSingleCard = run.length === 1;
        let moveSuccess = false;
        let revealCard = null;
        let prevFoundationCard = null;
        let foundationIdx = null;
        let movedToFoundation = false;
        let hasTableauOption = false;

        // 1. Long Press -> Foundation
        if (mode === "long" && isSingleCard) {
            if (Rules.checkFoundationMove(card, card.suit).ok) {
                pushHistory();
                const prev = state.foundations[card.suit];
                prevFoundationCard = prev.length > 0 ? snapshotCard(prev[prev.length - 1]) : null;
                foundationIdx = card.suit;
                state.foundations[card.suit].push(sourceArray.pop());
                if (type === 'tableau' && sourceArray.length > 0) sourceArray[sourceArray.length-1].isOpen = true;
                movedToFoundation = true;
                moveSuccess = true;
            }
        }
        
        // 2. Single Click -> Tableau Move
        if (!moveSuccess) {
            let bestTarget = -1;
            for (let i = 0; i < 7; i++) {
                if (type === 'tableau' && i === idx) continue;
                const resT = Rules.canPlaceOnTableau(run[0], i);
                if (resT.ok && resT.type === "Run") { bestTarget = i; break; }
            }
            if (bestTarget === -1) {
                for (let i = 0; i < 7; i++) {
                    if (type === 'tableau' && i === idx) continue;
                    const resT = Rules.canPlaceOnTableau(run[0], i);
                    if (resT.ok && resT.type === "K-only") { bestTarget = i; break; }
                }
            }
            if (bestTarget !== -1) hasTableauOption = true;
            if (bestTarget !== -1) {
                pushHistory();
                state.tableau[bestTarget] = state.tableau[bestTarget].concat(run);
                if (type === 'waste') state.waste.pop();
                else {
                    state.tableau[idx] = sourceArray.slice(0, cardIdx);
                    if (state.tableau[idx].length > 0 && !state.tableau[idx][state.tableau[idx].length - 1].isOpen) {
                      revealCard = state.tableau[idx][state.tableau[idx].length - 1];
                    }
                }
                moveSuccess = true;
            }
        }

        // 3. Single Click Fallback -> Foundation (only if no tableau option)
        if (!moveSuccess && mode === "single" && isSingleCard && !hasTableauOption) {
            if (Rules.checkFoundationMove(card, card.suit).ok) {
                pushHistory();
                const prev = state.foundations[card.suit];
                prevFoundationCard = prev.length > 0 ? snapshotCard(prev[prev.length - 1]) : null;
                foundationIdx = card.suit;
                state.foundations[card.suit].push(sourceArray.pop());
                if (type === 'tableau' && sourceArray.length > 0) sourceArray[sourceArray.length-1].isOpen = true;
                movedToFoundation = true;
                moveSuccess = true;
            }
        }

        if (moveSuccess) { 
          State.autoChainCount = 0;
          incrementMoveCount();
          if (movedToFoundation) {
            setLastMove("manual", { foundationIdx, prevFoundationCard });
          } else {
            setLastMove("manual");
          }
          UI.render(State.current); 
          const endAt = State.lastAnimationEndAt;
          const afterReveal = () => { triggerAutoFoundation(); requestAutoCheck(); };
          if (revealCard) scheduleReveal(revealCard, "manual", afterReveal, endAt);
          else waitForAnimationsThen(afterReveal);
        }
      }

      function checkVictoryCondition() {
        const state = State.current;
        const total = state.foundations.reduce((acc, f) => acc + f.length, 0);
        if (total === 52) { 
            State.isAutoMoving = false;
            updateWinStats();
            document.getElementById("win-overlay").style.display = "flex"; 
            return; 
        }
        const stockEmpty = state.stock.length === 0 && state.waste.length === 0;
        const allTableauOpen = state.tableau.every(col => col.every(c => c.isOpen));
        if (stockEmpty && allTableauOpen && !State.isAutoFinishing) {
            State.isAutoFinishing = true; State.isAutoMoving = true; setTimeout(autoDissolve, 50);
        }
      }

      function autoDissolve() {
        const state = State.current;
        let moved = false;
        let prevFoundationCard = null;
        let foundationIdx = null;
        for (let i = 0; i < 7; i++) {
            const col = state.tableau[i];
            if (col.length > 0) {
                const c = col[col.length - 1];
                if (Rules.checkFoundationMove(c, c.suit).ok) {
                    const prev = state.foundations[c.suit];
                    prevFoundationCard = prev.length > 0 ? snapshotCard(prev[prev.length - 1]) : null;
                    foundationIdx = c.suit;
                    state.foundations[c.suit].push(col.pop());
                    moved = true; break;
                }
            }
        }
        if (moved) { 
          State.autoChainCount += 1;
          State.maxAutoChainCount = Math.max(State.maxAutoChainCount, State.autoChainCount);
          setLastMove("auto", { foundationIdx, prevFoundationCard });
          UI.render(State.current); 
          waitForAnimationsThen(() => { setTimeout(autoDissolve, 80); });
        } else { 
          State.isAutoMoving = false;
          State.autoChainCount = 0;
          checkVictoryCondition(); 
        }
      }
      const Controller = {
        pushHistory,
        popHistory,
        updateButtons,
        showStatus,
        clearStatus,
        showWarning,
        hideWarning,
        requestAutoCheck,
        performAutoCheck,
        startNewGame,
        startTestGame,
        restartGame,
        triggerAutoFoundation,
        handleStockClick,
        hintMove,
        handleSlotClick,
        checkVictoryCondition,
        autoDissolve
      };

      /* --- [UI] --- */
      function render(state) {
        if (!state) return;
        const prevRects = new Map();
        document.querySelectorAll('playing-card[data-key]').forEach(el => {
          prevRects.set(el.dataset.key, el.getBoundingClientRect());
        });
        const stockRect = document.getElementById("stock")?.getBoundingClientRect();

        document.querySelectorAll('.slot, .column').forEach(el => {
            el.innerHTML = "";
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
        });
        
        const sEl = document.getElementById("stock");
        if (state.stock.length > 0) { sEl.innerHTML = `<playing-card cid="back" data-key="stock-back"></playing-card>`; }
        sEl.onclick = Controller.handleStockClick;

        const wEl = document.getElementById("waste");
        if (state.waste.length > 0) {
          const card = state.waste[state.waste.length - 1];
          if (State.lastMove && State.lastMove.type === "draw" && State.lastMove.prevWasteCard) {
            const prev = State.lastMove.prevWasteCard;
            const prevEl = document.createElement("playing-card");
            prevEl.setAttribute("cid", Rules.getCid(prev));
            prevEl.dataset.ghost = "waste";
            wEl.appendChild(prevEl);
          }
          const topEl = document.createElement("playing-card");
          topEl.setAttribute("cid", Rules.getCid(card));
          topEl.dataset.key = getCardKey(card);
          wEl.appendChild(topEl);
        }
        let wasteClickTimer = null;
        let wasteLongPressTimer = null;
        let wasteLongPressFired = false;
        wEl.onclick = () => {
          if (wasteLongPressFired) { 
            wasteLongPressFired = false;
            return; 
          }
          if (wasteClickTimer) { clearTimeout(wasteClickTimer); }
          wasteClickTimer = setTimeout(() => {
            Controller.handleSlotClick('waste', -1, "single");
            wasteClickTimer = null;
          }, Config.CLICK_DELAY_MS);
        };
        wEl.oncontextmenu = (e) => { e.preventDefault(); Controller.handleSlotClick('waste', -1, "right"); };
        wEl.onpointerdown = (e) => {
          const cardEl = e.target.closest('playing-card');
          if (!cardEl) return;
          wasteLongPressFired = false;
          if (wasteLongPressTimer) { clearTimeout(wasteLongPressTimer); }
          wasteLongPressTimer = setTimeout(() => {
            wasteLongPressFired = true;
            Controller.handleSlotClick('waste', -1, "long");
          }, 350);
        };
        wEl.onpointerup = () => {
          if (wasteLongPressTimer) { clearTimeout(wasteLongPressTimer); wasteLongPressTimer = null; }
        };
        wEl.onpointerleave = () => {
          if (wasteLongPressTimer) { clearTimeout(wasteLongPressTimer); wasteLongPressTimer = null; }
        };
        wEl.onpointercancel = () => {
          if (wasteLongPressTimer) { clearTimeout(wasteLongPressTimer); wasteLongPressTimer = null; }
        };

        state.foundations.forEach((stack, i) => {
          const el = document.getElementById(`foundation-${i}`);
          if (stack.length > 0) {
            const card = stack[stack.length - 1];
            if (State.lastMove && State.lastMove.foundationIdx === i && State.lastMove.prevFoundationCard) {
              const prev = State.lastMove.prevFoundationCard;
              const prevEl = document.createElement("playing-card");
              prevEl.setAttribute("cid", Rules.getCid(prev));
              prevEl.dataset.ghost = "foundation";
              el.appendChild(prevEl);
            }
            const topEl = document.createElement("playing-card");
            topEl.setAttribute("cid", Rules.getCid(card));
            topEl.dataset.key = getCardKey(card);
            el.appendChild(topEl);
          }
        });

        state.tableau.forEach((col, colIdx) => {
          const colEl = document.getElementById(`tableau-${colIdx}`);
          
          const overlap = col.length > 15 ? 15 : 20; 
          const stackHeight = 140 + (col.length > 0 ? (col.length - 1) * overlap : 0);
          colEl.style.height = `${stackHeight}px`;

          col.forEach((card, rowIdx) => {
            const el = document.createElement("playing-card");
            el.setAttribute("cid", Rules.getCid(card));
            el.style.top = `${rowIdx * overlap}px`; 
            el.dataset.idx = rowIdx;
            el.dataset.key = getCardKey(card);
            colEl.appendChild(el);
          });
          
          let tableauClickTimer = null;
          let longPressTimer = null;
          let longPressFired = false;
          let longPressIdx = -1;
          colEl.onclick = (e) => {
              const cardEl = e.target.closest('playing-card');
              const idx = cardEl ? parseInt(cardEl.dataset.idx) : -1;
              if (longPressFired && idx === longPressIdx) { 
                longPressFired = false;
                longPressIdx = -1;
                return; 
              }
              if (tableauClickTimer) { clearTimeout(tableauClickTimer); }
              tableauClickTimer = setTimeout(() => {
                Controller.handleSlotClick('tableau', colIdx, "single", idx);
                tableauClickTimer = null;
              }, Config.CLICK_DELAY_MS);
          };
          colEl.onpointerdown = (e) => {
              const cardEl = e.target.closest('playing-card');
              if (!cardEl) return;
              const idx = parseInt(cardEl.dataset.idx);
              if (idx !== col.length - 1) return;
              longPressFired = false;
              longPressIdx = idx;
              if (longPressTimer) { clearTimeout(longPressTimer); }
              longPressTimer = setTimeout(() => {
                longPressFired = true;
                Controller.handleSlotClick('tableau', colIdx, "long", idx);
              }, 350);
          };
          colEl.onpointerup = () => {
              if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
          };
          colEl.onpointerleave = () => {
              if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
          };
          colEl.onpointercancel = () => {
              if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
          };
        });

        const lastMove = State.lastMove || {};
        const motionRoot = window.motion;
        const motionAnimate = (typeof motionRoot === "function" ? motionRoot : (motionRoot && motionRoot.animate)) || null;
        const waapiAvailable = !!(Element.prototype && Element.prototype.animate);
        const shouldAnimate = lastMove.animate !== false && (typeof motionAnimate === "function" || waapiAvailable);
        const cleanupGhosts = () => {
          document.querySelectorAll('[data-ghost="waste"], [data-ghost="foundation"]').forEach(el => el.remove());
        };
        if (shouldAnimate) {
          const staggerMs = lastMove.type === "auto" ? Config.ANIM_STAGGER_MS : 0;
          const animatedEls = [];
          let animIndex = 0;
          let maxEndMs = 0;
          document.querySelectorAll('playing-card[data-key]').forEach(el => {
            const key = el.dataset.key;
            let fromRect = null;
            if (lastMove.type === "draw" && lastMove.cardKey === key && stockRect) {
              fromRect = stockRect;
            } else if (prevRects.has(key)) {
              fromRect = prevRects.get(key);
            }
            if (!fromRect) return;
            const toRect = el.getBoundingClientRect();
            const dx = fromRect.left - toRect.left;
            const dy = fromRect.top - toRect.top;
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
            el.style.transform = `translate(${dx}px, ${dy}px)`;
            el.style.willChange = "transform";
            el.style.zIndex = "9999";
            const distance = Math.hypot(dx, dy);
            const speed = Config.ANIM_SPEED_PX_PER_MS[lastMove.type] || Config.ANIM_SPEED_PX_PER_MS.manual;
            const gearBoost = lastMove.type === "auto"
              ? Math.min(
                  Config.ANIM_GEARUP.maxMultiplier,
                  1 + (Math.max(0, State.autoChainCount - Config.ANIM_GEARUP.startAt) * Config.ANIM_GEARUP.step)
                )
              : 1;
            const minMs = lastMove.type === "auto" ? (Config.ANIM_MIN_MS / gearBoost) : Config.ANIM_MIN_MS;
            const durationMs = Math.min(
              Config.ANIM_MAX_MS,
              Math.max(minMs, distance / (speed * gearBoost))
            );
            const delayMs = staggerMs ? (animIndex * staggerMs) : 0;
            maxEndMs = Math.max(maxEndMs, delayMs + durationMs);
            const easing = lastMove.type === "manual" ? Config.ANIM_EASE_MANUAL : Config.ANIM_EASE_AUTO;
            if (typeof motionAnimate === "function") {
              motionAnimate(el, { transform: [`translate(${dx}px, ${dy}px)`, "translate(0px, 0px)"] }, {
                duration: durationMs / 1000,
                easing,
                delay: delayMs / 1000
              });
            } else {
              el.animate(
                [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
                { duration: durationMs, easing, delay: delayMs, fill: "both" }
              );
            }
            animatedEls.push(el);
            animIndex++;
          });
          if (animatedEls.length > 0) {
            State.animatingCount += 1;
            State.isAnimating = true;
            const endAt = performance.now() + maxEndMs + Config.ANIM_END_BUFFER_MS;
            State.lastAnimationEndAt = endAt;
            const finishedPromise = new Promise(resolve => setTimeout(resolve, maxEndMs + Config.ANIM_END_BUFFER_MS));
            State.lastAnimationPromise = finishedPromise;
            finishedPromise.then(() => {
              animatedEls.forEach(el => { el.style.willChange = ""; el.style.zIndex = ""; });
              State.animatingCount = Math.max(0, State.animatingCount - 1);
              State.isAnimating = State.animatingCount > 0;
              cleanupGhosts();
            });
          } else {
            State.isAnimating = State.animatingCount > 0;
            cleanupGhosts();
            State.lastAnimationPromise = Promise.resolve();
            State.lastAnimationEndAt = performance.now();
          }
        } else {
          State.isAnimating = State.animatingCount > 0;
          cleanupGhosts();
          State.lastAnimationPromise = Promise.resolve();
          State.lastAnimationEndAt = performance.now();
        }
        State.lastMove = null;
      }
      const UI = { render };
      
      /* --- [Events] --- */
      document.addEventListener('keydown', (e) => {
        if (State.isAutoMoving || State.isAnimating) return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); Controller.popHistory(); }
        if (e.key === 'F2') { e.preventDefault(); Controller.startNewGame(); }
      });
      document.getElementById("btn-undo").onclick = Controller.popHistory;
      document.getElementById("btn-restart").onclick = Controller.restartGame;
      document.getElementById("btn-hint").onclick = Controller.hintMove;
      document.getElementById("new-game").onclick = Controller.startNewGame;
      document.getElementById("btn-test").onclick = Controller.startTestGame;
      document.getElementById("btn-deal-again").onclick = () => {
        document.getElementById("win-overlay").style.display = "none";
        hideStartKeyFallback();
        Controller.startNewGame();
      };
      document.getElementById("btn-show-startkey").onclick = () => {
        if (!State.startSeed) {
          alert("StartKey is not available for this board.");
          return;
        }
        const key = makeStartKey(State.startSeed, State.startAttemptIndex || 0);
        prompt("StartKey", key);
      };
      document.getElementById("btn-copy-startkey").onclick = async () => {
        const text = buildWinCopyText();
        hideStartKeyFallback();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            showStatus("StartKey Copied", "#00ff00");
            return;
          }
        } catch (e) {}
        if (tryLegacyCopy(text)) {
          showStatus("StartKey Copied", "#00ff00");
          return;
        }
        showStartKeyFallback(text);
      };
      document.getElementById("btn-select-startkey").onclick = () => {
        if (selectStartKeyInput()) showStatus("StartKey selected", "#ffff00");
      };
      document.getElementById("win-startkey-input").onclick = () => {
        selectStartKeyInput();
      };
      document.getElementById("btn-load-startkey").onclick = () => {
        const raw = prompt("Enter StartKey (SEED-ATTEMPT)", "");
        const parsed = parseStartKey(raw);
        if (!parsed) {
          alert("Invalid StartKey format. Use: A1B2C3D4-0012");
          return;
        }
        const state = bot.deal(bot.createDeckFromSeedAttempt(parsed.seed, parsed.attemptIndex));
        if (!bot.checkCurrentState(state)) {
          alert("StartKey is not solvable with current rules/settings.");
          return;
        }
        applyStartState(state, parsed.seed, parsed.attemptIndex);
      };
      document.getElementById("chk-autocheck").onchange = () => { Controller.requestAutoCheck(); };
      (function setupMenu() {
        const menuBtn = document.getElementById("btn-menu");
        const menuPanel = document.getElementById("menu-panel");
        if (!menuBtn || !menuPanel) return;
        const closeMenu = () => {
          menuPanel.hidden = true;
          menuBtn.setAttribute("aria-expanded", "false");
        };
        const openMenu = () => {
          menuPanel.hidden = false;
          menuBtn.setAttribute("aria-expanded", "true");
        };
        menuBtn.onclick = (e) => {
          e.stopPropagation();
          if (menuPanel.hidden) openMenu();
          else closeMenu();
        };
        menuPanel.addEventListener("click", (e) => {
          e.stopPropagation();
        });
        document.addEventListener("click", () => {
          closeMenu();
        });
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") closeMenu();
        });
        ["btn-restart", "new-game", "btn-test", "chk-autocheck", "btn-show-startkey", "btn-load-startkey"].forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.addEventListener("click", () => {
            closeMenu();
          });
        });
      })();

      window.addEventListener('load', () => {
        customElements.whenDefined('playing-card').then(() => {
          if (!Persistence.restoreFromLocal()) {
            setTimeout(Controller.startNewGame, 300);
          }
        });
      });
