/**
 * FLAPPY WYZUK - USER INTERFACE & MODAL CONTROLLER
 * Author: Wyzuk (https://github.com/wyzuk)
 * Repository: https://github.com/wyzuk/flappy
 */

const UIManager = (() => {
    const screenMainMenu = document.getElementById('screen-main-menu');
    const screenPauseMenu = document.getElementById('screen-pause-menu');
    const screenGameOver = document.getElementById('screen-game-over');
    const gameHud = document.getElementById('game-hud');
    const mobileJumpControls = document.getElementById('mobile-jump-controls');
    const mobileJumpBtn = document.getElementById('mobile-jump-btn');

    const modalBirds = document.getElementById('modal-birds');
    const modalThemes = document.getElementById('modal-themes');
    const modalLeaderboard = document.getElementById('modal-leaderboard');
    const modalSettings = document.getElementById('modal-settings');
    const modalCredits = document.getElementById('modal-credits');

    const hudCurrentScore = document.getElementById('hud-current-score');
    const hudBestScore = document.getElementById('hud-best-score');
    const hudDiffProgress = document.getElementById('hud-diff-progress');
    const hudReadyHint = document.getElementById('hud-ready-hint');
    const btnQuickMute = document.getElementById('btn-quick-mute');
    const btnQuickPause = document.getElementById('btn-quick-pause');
    const soundOnIcon = btnQuickMute.querySelector('.sound-on-icon');
    const soundOffIcon = btnQuickMute.querySelector('.sound-off-icon');

    const menuBirdPreviewCanvas = document.getElementById('menu-bird-preview-canvas');
    const menuSelectedBirdName = document.getElementById('menu-selected-bird-name');
    const menuSelectedThemeName = document.getElementById('menu-selected-theme-name');

    const gameOverFinalScore = document.getElementById('game-over-final-score');
    const gameOverHighScore = document.getElementById('game-over-high-score');
    const gameOverNewBestBadge = document.getElementById('game-over-new-best-badge');
    const gameOverMedal = document.getElementById('game-over-medal');
    const medalIcon = document.getElementById('medal-icon');
    const medalName = document.getElementById('medal-name');

    const pauseScoreVal = document.getElementById('pause-score-val');
    const pauseBestVal = document.getElementById('pause-best-val');

    const settingMasterSound = document.getElementById('setting-master-sound');
    const settingSfxVolume = document.getElementById('setting-sfx-volume');
    const valSfxVol = document.getElementById('val-sfx-vol');
    const settingAmbientMusic = document.getElementById('setting-ambient-music');
    const settingScreenShake = document.getElementById('setting-screen-shake');
    const settingParticleDensity = document.getElementById('setting-particle-density');
    const settingReducedMotion = document.getElementById('setting-reduced-motion');

    const statsBestScoreDisplay = document.getElementById('stats-best-score-display');
    const statTotalGames = document.getElementById('stat-total-games');
    const statTotalFlaps = document.getElementById('stat-total-flaps');
    const statTotalPipes = document.getElementById('stat-total-pipes');
    const statRankTier = document.getElementById('stat-rank-tier');
    const btnResetStats = document.getElementById('btn-reset-stats');

    const birdsGridContainer = document.getElementById('birds-grid-container');
    const birdDetailDesc = document.getElementById('bird-detail-desc');
    const themesGridContainer = document.getElementById('themes-grid-container');
    const themeDetailDesc = document.getElementById('theme-detail-desc');
    const toastContainer = document.getElementById('toast-container');

    let onStartGameCb = null;
    let onFlapActionCb = null;
    let onPauseGameCb = null;
    let onResumeGameCb = null;
    let onRestartGameCb = null;
    let onReturnMenuCb = null;
    let onBirdChangedCb = null;
    let onThemeChangedCb = null;

    function init(callbacks) {
        onStartGameCb = callbacks.onStartGame;
        onFlapActionCb = callbacks.onFlapAction;
        onPauseGameCb = callbacks.onPauseGame;
        onResumeGameCb = callbacks.onResumeGame;
        onRestartGameCb = callbacks.onRestartGame;
        onReturnMenuCb = callbacks.onReturnMenu;
        onBirdChangedCb = callbacks.onBirdChanged;
        onThemeChangedCb = callbacks.onThemeChanged;

        detectTouchDevice();
        bindEvents();
        populateBirdsModal();
        populateThemesModal();
        syncSettingsUI();
        updateMenuShowcase();
    }

    function isTouchDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    }

    function detectTouchDevice() {
        if (isTouchDevice()) {
            mobileJumpControls.classList.remove('hidden');
        } else {
            mobileJumpControls.classList.add('hidden');
        }
    }

    function showToast(message) {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span>⚡</span><span>${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2200);
    }

    function bindEvents() {
        document.getElementById('btn-play').addEventListener('click', () => {
            AudioManager.playClick();
            if (onStartGameCb) onStartGameCb();
        });

        document.getElementById('btn-open-birds').addEventListener('click', () => openModal(modalBirds));
        document.getElementById('btn-open-themes').addEventListener('click', () => openModal(modalThemes));
        document.getElementById('btn-open-leaderboard').addEventListener('click', () => {
            updateStatsModal();
            openModal(modalLeaderboard);
        });
        document.getElementById('btn-open-settings').addEventListener('click', () => openModal(modalSettings));
        document.getElementById('btn-open-credits').addEventListener('click', () => openModal(modalCredits));

        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = btn.getAttribute('data-close-modal');
                const modal = document.getElementById(modalId);
                if (modal) closeModal(modal);
                else {
                    const closest = btn.closest('.ui-modal');
                    if (closest) closeModal(closest);
                }
            });
        });

        document.querySelectorAll('.modal-backdrop').forEach(bd => {
            bd.addEventListener('click', (e) => {
                const modal = bd.closest('.ui-modal');
                if (modal) closeModal(modal);
            });
        });

        btnQuickMute.addEventListener('click', () => {
            const data = StorageManager.get();
            const newState = !data.settings.masterSound;
            StorageManager.updateSettings({ masterSound: newState });
            AudioManager.applySettings();
            syncSoundIcons(newState);
            showToast(newState ? 'Audio Unmuted' : 'Audio Muted');
        });

        btnQuickPause.addEventListener('click', () => {
            AudioManager.playClick();
            if (onPauseGameCb) onPauseGameCb();
        });

        document.getElementById('btn-resume-game').addEventListener('click', () => {
            AudioManager.playClick();
            if (onResumeGameCb) onResumeGameCb();
        });

        document.getElementById('btn-restart-from-pause').addEventListener('click', () => {
            AudioManager.playClick();
            if (onRestartGameCb) onRestartGameCb();
        });

        document.getElementById('btn-pause-to-settings').addEventListener('click', () => {
            AudioManager.playClick();
            openModal(modalSettings);
        });

        document.getElementById('btn-pause-to-menu').addEventListener('click', () => {
            AudioManager.playClick();
            if (onReturnMenuCb) onReturnMenuCb();
        });

        document.getElementById('btn-play-again').addEventListener('click', () => {
            AudioManager.playClick();
            if (onRestartGameCb) onRestartGameCb();
        });

        document.getElementById('btn-game-over-menu').addEventListener('click', () => {
            AudioManager.playClick();
            if (onReturnMenuCb) onReturnMenuCb();
        });

        document.getElementById('btn-share-score').addEventListener('click', () => {
            handleShareScore();
        });

        btnResetStats.addEventListener('click', () => {
            StorageManager.resetStats();
            updateStatsModal();
            showToast('Flight statistics reset!');
        });

        mobileJumpBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            createRipple(e, mobileJumpBtn);
            if (onFlapActionCb) onFlapActionCb();
        }, { passive: false });

        mobileJumpBtn.addEventListener('mousedown', (e) => {
            createRipple(e, mobileJumpBtn);
            if (onFlapActionCb) onFlapActionCb();
        });

        settingMasterSound.addEventListener('change', (e) => {
            StorageManager.updateSettings({ masterSound: e.target.checked });
            AudioManager.applySettings();
            syncSoundIcons(e.target.checked);
        });

        settingSfxVolume.addEventListener('input', (e) => {
            valSfxVol.textContent = `${e.target.value}%`;
            StorageManager.updateSettings({ sfxVolume: parseInt(e.target.value, 10) });
            AudioManager.applySettings();
        });

        settingAmbientMusic.addEventListener('change', (e) => {
            StorageManager.updateSettings({ ambientMusic: e.target.checked });
            AudioManager.applySettings();
        });

        settingScreenShake.addEventListener('change', (e) => {
            StorageManager.updateSettings({ screenShake: e.target.checked });
        });

        settingParticleDensity.addEventListener('change', (e) => {
            StorageManager.updateSettings({ particleDensity: e.target.value });
        });

        settingReducedMotion.addEventListener('change', (e) => {
            StorageManager.updateSettings({ reducedMotion: e.target.checked });
        });
    }

    function createRipple(event, button) {
        const circle = document.createElement('span');
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `calc(50% - ${radius}px)`;
        circle.style.top = `calc(50% - ${radius}px)`;
        circle.classList.add('jump-ripple');

        const rippleContainer = button.querySelector('.jump-ripple-container') || button;
        rippleContainer.appendChild(circle);

        setTimeout(() => circle.remove(), 600);
    }

    function openModal(modal) {
        if (!modal) return;
        AudioManager.playClick();
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal(modal) {
        if (!modal) return;
        AudioManager.playClick();
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }

    function syncSoundIcons(isEnabled) {
        if (isEnabled) {
            soundOnIcon.classList.remove('hidden');
            soundOffIcon.classList.add('hidden');
        } else {
            soundOnIcon.classList.add('hidden');
            soundOffIcon.classList.remove('hidden');
        }
    }

    function syncSettingsUI() {
        const data = StorageManager.get();
        settingMasterSound.checked = data.settings.masterSound;
        settingSfxVolume.value = data.settings.sfxVolume;
        valSfxVol.textContent = `${data.settings.sfxVolume}%`;
        settingAmbientMusic.checked = data.settings.ambientMusic;
        settingScreenShake.checked = data.settings.screenShake;
        settingParticleDensity.value = data.settings.particleDensity;
        settingReducedMotion.checked = data.settings.reducedMotion;
        syncSoundIcons(data.settings.masterSound);
    }

    function updateMenuShowcase() {
        const data = StorageManager.get();
        const bird = BirdsManager.getBird(data.selectedBirdId);
        const theme = BackgroundsManager.getTheme(data.selectedThemeId);

        menuSelectedBirdName.textContent = bird.name;
        menuSelectedThemeName.textContent = theme.name;
        BirdsManager.renderPreview(menuBirdPreviewCanvas, bird.id);
    }

    function populateBirdsModal() {
        birdsGridContainer.innerHTML = '';
        const allBirds = BirdsManager.getAllBirds();
        const currentSelected = StorageManager.get().selectedBirdId;

        allBirds.forEach(bird => {
            const card = document.createElement('div');
            card.className = `bird-card-item ${bird.id === currentSelected ? 'selected' : ''}`;
            card.setAttribute('data-bird-id', bird.id);

            card.innerHTML = `
                <canvas class="bird-card-preview" width="68" height="54"></canvas>
                <span class="bird-card-name">${bird.name}</span>
                ${bird.id === currentSelected ? '<span class="selected-badge">✓</span>' : ''}
            `;

            const canvas = card.querySelector('canvas');
            BirdsManager.renderPreview(canvas, bird.id);

            card.addEventListener('click', () => {
                AudioManager.playClick();
                StorageManager.setSelectedBird(bird.id);
                birdDetailDesc.textContent = bird.desc;
                document.querySelectorAll('.bird-card-item').forEach(c => {
                    c.classList.remove('selected');
                    const badge = c.querySelector('.selected-badge');
                    if (badge) badge.remove();
                });
                card.classList.add('selected');
                const newBadge = document.createElement('span');
                newBadge.className = 'selected-badge';
                newBadge.textContent = '✓';
                card.appendChild(newBadge);
                updateMenuShowcase();
                if (onBirdChangedCb) onBirdChangedCb(bird);
                showToast(`Equipped ${bird.name}`);
            });

            birdsGridContainer.appendChild(card);
        });
    }

    function populateThemesModal() {
        themesGridContainer.innerHTML = '';
        const allThemes = BackgroundsManager.getAllThemes();
        const currentSelected = StorageManager.get().selectedThemeId;

        allThemes.forEach(theme => {
            const card = document.createElement('div');
            card.className = `theme-card-item ${theme.id === currentSelected ? 'selected' : ''}`;
            card.setAttribute('data-theme-id', theme.id);

            card.innerHTML = `
                <div class="theme-card-preview" style="background: linear-gradient(135deg, ${theme.skyColors[0]}, ${theme.skyColors[1] || theme.skyColors[0]});"></div>
                <span class="theme-card-name">${theme.name}</span>
                ${theme.id === currentSelected ? '<span class="selected-badge">✓</span>' : ''}
            `;

            card.addEventListener('click', () => {
                AudioManager.playClick();
                StorageManager.setSelectedTheme(theme.id);
                themeDetailDesc.textContent = theme.desc;
                document.querySelectorAll('.theme-card-item').forEach(c => {
                    c.classList.remove('selected');
                    const badge = c.querySelector('.selected-badge');
                    if (badge) badge.remove();
                });
                card.classList.add('selected');
                const newBadge = document.createElement('span');
                newBadge.className = 'selected-badge';
                newBadge.textContent = '✓';
                card.appendChild(newBadge);
                updateMenuShowcase();
                if (onThemeChangedCb) onThemeChangedCb(theme);
                showToast(`World set to ${theme.name}`);
            });

            themesGridContainer.appendChild(card);
        });
    }

    function updateStatsModal() {
        const data = StorageManager.get();
        statsBestScoreDisplay.textContent = data.highScore;
        statTotalGames.textContent = data.totalGames || 0;
        statTotalFlaps.textContent = data.totalFlaps || 0;
        statTotalPipes.textContent = data.totalPipes || 0;

        let rank = 'Rookie Flapper';
        if (data.highScore >= 100) rank = 'Cyber Legend 👑';
        else if (data.highScore >= 60) rank = 'Diamond Ace 💎';
        else if (data.highScore >= 40) rank = 'Platinum Wing ⚡';
        else if (data.highScore >= 25) rank = 'Gold Aviator 🥇';
        else if (data.highScore >= 10) rank = 'Silver Pilot 🥈';
        else if (data.highScore >= 5) rank = 'Bronze Scout 🥉';

        statRankTier.textContent = rank;
    }

    function animateScoreCounter(targetElement, targetVal) {
        let current = 0;
        const duration = 1000;
        const stepTime = 20;
        const steps = duration / stepTime;
        const increment = targetVal / steps;

        if (targetVal === 0) {
            targetElement.textContent = '0';
            return;
        }

        const timer = setInterval(() => {
            current += increment;
            if (current >= targetVal) {
                targetElement.textContent = targetVal;
                clearInterval(timer);
            } else {
                targetElement.textContent = Math.floor(current);
            }
        }, stepTime);
    }

    function getMedalTier(score) {
        if (score >= 60) return { icon: '💎', name: 'Diamond Master', class: 'medal-diamond' };
        if (score >= 25) return { icon: '🥇', name: 'Gold Aviator', class: 'medal-gold' };
        if (score >= 10) return { icon: '🥈', name: 'Silver Flapper', class: 'medal-silver' };
        return { icon: '🥉', name: 'Bronze Pilot', class: 'medal-bronze' };
    }

    function showGameOver(score, isNewBest) {
        const data = StorageManager.get();
        hideAllScreens();
        screenGameOver.classList.add('active');

        gameOverHighScore.textContent = data.highScore;
        animateScoreCounter(gameOverFinalScore, score);

        if (isNewBest && score > 0) {
            gameOverNewBestBadge.classList.remove('hidden');
        } else {
            gameOverNewBestBadge.classList.add('hidden');
        }

        const medal = getMedalTier(score);
        medalIcon.textContent = medal.icon;
        medalName.textContent = medal.name;
        gameOverMedal.className = `medal-badge ${medal.class}`;
    }

    function showPauseScreen(score) {
        const data = StorageManager.get();
        pauseScoreVal.textContent = score;
        pauseBestVal.textContent = data.highScore;
        screenPauseMenu.classList.add('active');
    }

    function hidePauseScreen() {
        screenPauseMenu.classList.remove('active');
    }

    function showMainMenu() {
        hideAllScreens();
        updateMenuShowcase();
        screenMainMenu.classList.add('active');
        gameHud.classList.add('hidden');
    }

    function showGameHud() {
        hideAllScreens();
        gameHud.classList.remove('hidden');
        hudReadyHint.classList.remove('hidden');
        updateHudScores(0, StorageManager.get().highScore, 0);
    }

    function hideReadyHint() {
        hudReadyHint.classList.add('hidden');
    }

    function hideAllScreens() {
        screenMainMenu.classList.remove('active');
        screenPauseMenu.classList.remove('active');
        screenGameOver.classList.remove('active');
    }

    function updateHudScores(currentScore, bestScore, diffProgress = 0) {
        hudCurrentScore.textContent = currentScore;
        hudBestScore.textContent = bestScore;
        hudDiffProgress.style.width = `${Math.min(100, Math.max(5, diffProgress * 100))}%`;

        hudCurrentScore.classList.remove('score-pop');
        void hudCurrentScore.offsetWidth; // Trigger reflow
        hudCurrentScore.classList.add('score-pop');
    }

    function handleShareScore() {
        const score = gameOverFinalScore.textContent;
        const shareData = {
            title: 'Flappy Wyzuk',
            text: `I just scored ${score} in Flappy Wyzuk! Can you beat my record?`,
            url: 'https://github.com/wyzuk/flappy'
        };

        if (navigator.share) {
            navigator.share(shareData).catch(() => {});
        } else {
            navigator.clipboard.writeText(`Flappy Wyzuk Score: ${score} points! Play at: https://github.com/wyzuk/flappy`)
                .then(() => showToast('Score copied to clipboard!'))
                .catch(() => showToast('Flappy Wyzuk by Wyzuk'));
        }
    }

    return {
        init,
        showMainMenu,
        showGameHud,
        hideReadyHint,
        showPauseScreen,
        hidePauseScreen,
        showGameOver,
        updateHudScores,
        showToast
    };
})();
