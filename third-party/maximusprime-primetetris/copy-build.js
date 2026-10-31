const fs = require('fs');
const path = require('path');

const projectDir = __dirname;
const rootDir = path.join(projectDir, '..');
const webTargetDir = path.join(rootDir, 'PrimeTetrisWeb-app');

console.log('📦 Derleme/dağıtım dosyaları güncelleniyor...');

// 1. Web Sürümü Kopyalama (Wallpaper yerleşimi kaynaktan otomatik üretilir)
if (fs.existsSync(webTargetDir)) {
    try {
        const htmlSrc = path.join(projectDir, 'Tetris.html');
        const htmlDest = path.join(webTargetDir, 'index.html');
        if (fs.existsSync(htmlSrc)) {
            const desktopHtml = fs.readFileSync(htmlSrc, 'utf8');
            // Lively Wallpaper: Windows görev çubuğu butonları örter → --chrome-bottom yükseltilir
            const webHtml = desktopHtml
                .replace(
                    /justify-content: center;\r?\n\s+min-height: 100vh;/,
                    'justify-content: flex-start;\n            padding-top: 15px;\n            padding-bottom: 80px;\n            height: 100vh;'
                )
                .replace(
                    '-webkit-app-region: drag; /* Pencereyi sürüklenebilir yap */',
                    'box-sizing: border-box;'
                )
                .replace(
                    '--chrome-bottom: 20px;',
                    '--chrome-bottom: 68px; /* Lively/görev çubuğu güvenli alan */'
                )
                .replace('const maxYukseklik = window.innerHeight - 160;', 'const maxYukseklik = window.innerHeight - 230;');

            fs.writeFileSync(htmlDest, webHtml, 'utf8');
            console.log(`🌐 Web sürümü (index.html) güncellendi.`);
        }

        const webAssets = ['icon.png', 'icon.ico', 'maximus-prime-software-rounded.png'];
        webAssets.forEach(asset => {
            const assetSrc = path.join(projectDir, asset);
            const assetDest = path.join(webTargetDir, asset);
            if (fs.existsSync(assetSrc)) {
                fs.copyFileSync(assetSrc, assetDest);
            }
        });

        // Yerel yazı tipleri (Orbitron) — web sürümüne kopyala
        const fontsSrc = path.join(projectDir, 'fonts');
        const fontsDest = path.join(webTargetDir, 'fonts');
        if (fs.existsSync(fontsSrc)) {
            fs.mkdirSync(fontsDest, { recursive: true });
            fs.readdirSync(fontsSrc).forEach(file => {
                fs.copyFileSync(path.join(fontsSrc, file), path.join(fontsDest, file));
            });
            console.log(`🌐 Web sürümü fonts kopyalandı.`);
        }

        // Eski paket denemesinden kalan LivelyInfo.json varsa kaldır
        // (Lively, index.html eklerken klasörde LivelyInfo bulursa hata veriyor)
        const livelyInfoPath = path.join(webTargetDir, 'LivelyInfo.json');
        if (fs.existsSync(livelyInfoPath)) {
            fs.unlinkSync(livelyInfoPath);
            console.log(`🌐 LivelyInfo.json kaldırıldı (Lively import hatasını önler).`);
        }

        console.log(`🌐 Web sürümü asset'leri kopyalandı.`);
    } catch (e) {
        console.error(`⚠️ Web kopyalama hatası: ${e.message}`);
    }
}

console.log('🎉 Dağıtım işlemi tamamlandı!');
