const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function getScoreDir() {
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
        return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data');
    }
    try {
        return path.join(app.getPath('userData'), 'data');
    } catch (e) {
        return path.join(__dirname, 'data');
    }
}

function getScoreFilePath() {
    return path.join(getScoreDir(), 'highscore.json');
}

function ensureDataDirAndFile() {
    try {
        const dir = getScoreDir();
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const filePath = getScoreFilePath();
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({ highScore: 0 }), 'utf8');
        }
    } catch (e) {
        console.error('Data klasörü veya dosya oluşturma hatası:', e);
    }
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 850,
        minWidth: 800,
        minHeight: 650,
        show: false,
        backgroundColor: '#0b0c10',
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0f172a',
            symbolColor: '#00f2fe',
            height: 30
        },
        title: "Prime Tetris",
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.loadFile('Tetris.html');
}

app.whenReady().then(() => {
    ensureDataDirAndFile();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handler: Skoru Oku
ipcMain.handle('get-high-score', () => {
    try {
        const scoreFilePath = getScoreFilePath();
        if (fs.existsSync(scoreFilePath)) {
            const data = fs.readFileSync(scoreFilePath, 'utf8');
            return JSON.parse(data).highScore || 0;
        }
    } catch (e) {
        console.error('Skor okuma hatası:', e);
    }
    return 0;
});

// IPC Handler: Skoru Kaydet
ipcMain.on('save-high-score', (event, score) => {
    try {
        ensureDataDirAndFile();
        const scoreFilePath = getScoreFilePath();
        fs.writeFileSync(scoreFilePath, JSON.stringify({ highScore: score }));
    } catch (e) {
        console.error('Skor kaydetme hatası:', e);
    }
});

// IPC Handler: Skoru Sıfırla
ipcMain.on('reset-high-score', () => {
    try {
        ensureDataDirAndFile();
        const scoreFilePath = getScoreFilePath();
        fs.writeFileSync(scoreFilePath, JSON.stringify({ highScore: 0 }));
    } catch (e) {
        console.error('Skor sıfırlama hatası:', e);
    }
});

ipcMain.on('open-external', (event, url) => {
    const allowedUrl = typeof url === 'string' && (
        /^https:\/\/(github\.com|www\.github\.com)\//i.test(url) ||
        /^https:\/\/maximusprimesoftware\.pages\.dev(\/|$)/i.test(url) ||
        /^mailto:maximusprimesoftware@gmail\.com$/i.test(url)
    );
    if (allowedUrl) {
        shell.openExternal(url);
    }
});
