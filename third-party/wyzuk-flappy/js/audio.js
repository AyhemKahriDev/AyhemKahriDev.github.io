/**
 * FLAPPY WYZUK - PROCEDURAL WEB AUDIO SYNTHESIZER
 * Author: Wyzuk (https://github.com/wyzuk)
 * Repository: https://github.com/wyzuk/flappy
 */

const AudioManager = (() => {
    let audioCtx = null;
    let masterGain = null;
    let sfxGain = null;
    let musicGain = null;
    let isMusicPlaying = false;
    let musicTimer = null;
    let currentChordIndex = 0;

    const ambientChords = [
        [220, 277.18, 329.63, 440], // A Major
        [174.61, 220, 261.63, 349.23], // F Major
        [196, 246.94, 293.66, 392], // G Major
        [164.81, 196, 246.94, 329.63] // E Minor
    ];

    function init() {
        if (audioCtx) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            audioCtx = new AudioContextClass();

            masterGain = audioCtx.createGain();
            sfxGain = audioCtx.createGain();
            musicGain = audioCtx.createGain();

            sfxGain.connect(masterGain);
            musicGain.connect(masterGain);
            masterGain.connect(audioCtx.destination);

            applySettings();
        } catch (e) {
            console.warn('Web Audio API not supported', e);
        }
    }

    function ensureContext() {
        if (!audioCtx) init();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function applySettings() {
        if (!masterGain) return;
        const state = StorageManager.get();
        const masterEnabled = state.settings.masterSound;
        const sfxVol = (state.settings.sfxVolume / 100) * 0.4;
        const musicEnabled = state.settings.ambientMusic;

        masterGain.gain.setValueAtTime(masterEnabled ? 1 : 0, audioCtx ? audioCtx.currentTime : 0);
        sfxGain.gain.setValueAtTime(sfxVol, audioCtx ? audioCtx.currentTime : 0);
        musicGain.gain.setValueAtTime(musicEnabled && masterEnabled ? 0.12 : 0, audioCtx ? audioCtx.currentTime : 0);

        if (musicEnabled && masterEnabled && !isMusicPlaying) {
            startAmbientMusic();
        } else if ((!musicEnabled || !masterEnabled) && isMusicPlaying) {
            stopAmbientMusic();
        }
    }


    function playJump() {
        ensureContext();
        if (!audioCtx || !sfxGain) return;
        const now = audioCtx.currentTime;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.12);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(sfxGain);

        osc.start(now);
        osc.stop(now + 0.16);
    }

    function playScore() {
        ensureContext();
        if (!audioCtx || !sfxGain) return;
        const now = audioCtx.currentTime;

        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(587.33, now); // D5
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

        gain1.gain.setValueAtTime(0.3, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc1.connect(gain1);
        gain1.connect(sfxGain);
        osc1.start(now);
        osc1.stop(now + 0.26);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1174.66, now + 0.06); // D6
        gain2.gain.setValueAtTime(0.2, now + 0.06);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc2.connect(gain2);
        gain2.connect(sfxGain);
        osc2.start(now + 0.06);
        osc2.stop(now + 0.36);
    }

    function playHit() {
        ensureContext();
        if (!audioCtx || !sfxGain) return;
        const now = audioCtx.currentTime;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.31);

        const bufferSize = audioCtx.sampleRate * 0.12;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(800, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.12);

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(sfxGain);

        noise.start(now);
    }

    function playNewBest() {
        ensureContext();
        if (!audioCtx || !sfxGain) return;
        const now = audioCtx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        notes.forEach((freq, idx) => {
            const time = now + idx * 0.08;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.35, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

            osc.connect(gain);
            gain.connect(sfxGain);

            osc.start(time);
            osc.stop(time + 0.42);
        });
    }

    function playClick() {
        ensureContext();
        if (!audioCtx || !sfxGain) return;
        const now = audioCtx.currentTime;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(sfxGain);

        osc.start(now);
        osc.stop(now + 0.05);
    }


    function playAmbientPad(chord) {
        if (!audioCtx || !musicGain || !isMusicPlaying) return;
        const now = audioCtx.currentTime;
        const duration = 4.8;

        chord.forEach((freq) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, now);
            filter.frequency.linearRampToValueAtTime(1100, now + duration * 0.5);
            filter.frequency.linearRampToValueAtTime(500, now + duration);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.04, now + 1.2);
            gain.gain.linearRampToValueAtTime(0, now + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(musicGain);

            osc.start(now);
            osc.stop(now + duration + 0.1);
        });
    }

    function scheduleNextChord() {
        if (!isMusicPlaying) return;
        const chord = ambientChords[currentChordIndex];
        playAmbientPad(chord);
        currentChordIndex = (currentChordIndex + 1) % ambientChords.length;
        musicTimer = setTimeout(scheduleNextChord, 4500);
    }

    function startAmbientMusic() {
        if (isMusicPlaying) return;
        isMusicPlaying = true;
        scheduleNextChord();
    }

    function stopAmbientMusic() {
        isMusicPlaying = false;
        if (musicTimer) {
            clearTimeout(musicTimer);
            musicTimer = null;
        }
    }

    return {
        init,
        ensureContext,
        applySettings,
        playJump,
        playScore,
        playHit,
        playNewBest,
        playClick,
        startAmbientMusic,
        stopAmbientMusic
    };
})();
