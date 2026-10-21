/**
 * FLAPPY WYZUK - STORAGE & PERSISTENCE MANAGER
 * Author: Wyzuk (https://github.com/wyzuk)
 * Repository: https://github.com/wyzuk/flappy
 */

const StorageManager = (() => {
    const STORAGE_KEY = 'wyzuk_flappy_data_v1';

    const defaultData = {
        highScore: 0,
        totalGames: 0,
        totalFlaps: 0,
        totalPipes: 0,
        selectedBirdId: 'gold',
        selectedThemeId: 'sunny',
        settings: {
            masterSound: true,
            sfxVolume: 80,
            ambientMusic: true,
            screenShake: true,
            particleDensity: 'high', // 'ultra', 'high', 'medium', 'low'
            reducedMotion: false
        }
    };

    let cachedData = null;

    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                cachedData = { ...defaultData, ...parsed, settings: { ...defaultData.settings, ...parsed.settings } };
            } else {
                cachedData = JSON.parse(JSON.stringify(defaultData));
            }
        } catch (e) {
            console.warn('LocalStorage unavailable, fallback to memory', e);
            cachedData = JSON.parse(JSON.stringify(defaultData));
        }
        return cachedData;
    }

    function saveData() {
        try {
            if (cachedData) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedData));
            }
        } catch (e) {
            console.warn('Could not save to LocalStorage', e);
        }
    }

    function get() {
        if (!cachedData) loadData();
        return cachedData;
    }

    function updateHighScore(score) {
        const data = get();
        if (score > data.highScore) {
            data.highScore = score;
            saveData();
            return true; // New record
        }
        return false;
    }

    function incrementGames() {
        const data = get();
        data.totalGames = (data.totalGames || 0) + 1;
        saveData();
    }

    function incrementFlaps() {
        const data = get();
        data.totalFlaps = (data.totalFlaps || 0) + 1;
        saveData();
    }

    function addPipes(count) {
        const data = get();
        data.totalPipes = (data.totalPipes || 0) + count;
        saveData();
    }

    function setSelectedBird(birdId) {
        const data = get();
        data.selectedBirdId = birdId;
        saveData();
    }

    function setSelectedTheme(themeId) {
        const data = get();
        data.selectedThemeId = themeId;
        saveData();
    }

    function updateSettings(newSettings) {
        const data = get();
        data.settings = { ...data.settings, ...newSettings };
        saveData();
    }

    function resetStats() {
        const data = get();
        data.highScore = 0;
        data.totalGames = 0;
        data.totalFlaps = 0;
        data.totalPipes = 0;
        saveData();
        return data;
    }

    return {
        loadData,
        get,
        updateHighScore,
        incrementGames,
        incrementFlaps,
        addPipes,
        setSelectedBird,
        setSelectedTheme,
        updateSettings,
        resetStats
    };
})();
