/**
 * FLAPPY WYZUK - MULTI-LAYER PARALLAX BACKGROUND WORLDS
 * Author: Wyzuk (https://github.com/wyzuk)
 * Repository: https://github.com/wyzuk/flappy
 */

const BackgroundsManager = (() => {
    const THEMES_LIST = [
        {
            id: 'sunny',
            name: 'Sunny Sky',
            desc: 'Crisp golden sunlight, fluffy rolling clouds, and emerald hills.',
            weather: 'none',
            skyColors: ['#0284c7', '#38bdf8', '#bae6fd'],
            groundColor: '#15803d',
            pipeGrad: ['#22c55e', '#16a34a'],
            pipeCap: '#15803d',
            pipeBorder: 'rgba(255, 255, 255, 0.4)'
        },
        {
            id: 'sunset',
            name: 'Sunset Synthwave',
            desc: 'Retro 80s aesthetic sun, wireframe mountains, and neon grids.',
            weather: 'none',
            skyColors: ['#3b0764', '#c026d3', '#f43f5e', '#fbbf24'],
            groundColor: '#180326',
            pipeGrad: ['#ff2a7a', '#892cdc'],
            pipeCap: '#00f2fe',
            pipeBorder: 'rgba(0, 242, 254, 0.6)'
        },
        {
            id: 'night',
            name: 'Cyber City Night',
            desc: 'Luminous neon skyscrapers, glowing windows, and moonlit skies.',
            weather: 'none',
            skyColors: ['#030712', '#0f172a', '#1e1b4b'],
            groundColor: '#090d16',
            pipeGrad: ['#00f2fe', '#0284c7'],
            pipeCap: '#ff2a7a',
            pipeBorder: 'rgba(255, 42, 122, 0.5)'
        },
        {
            id: 'forest',
            name: 'Enchanted Forest',
            desc: 'Mystic ancient trees, lush mossy canopy, and glowing fireflies.',
            weather: 'fireflies',
            skyColors: ['#022c22', '#064e3b', '#065f46'],
            groundColor: '#022c22',
            pipeGrad: ['#059669', '#047857'],
            pipeCap: '#a7f3d0',
            pipeBorder: 'rgba(167, 243, 208, 0.4)'
        },
        {
            id: 'mountains',
            name: 'Alpine Aurora',
            desc: 'Wavy northern aurora ribbons over snowy mountain peaks.',
            weather: 'none',
            skyColors: ['#090d16', '#064e3b', '#0369a1'],
            groundColor: '#1e293b',
            pipeGrad: ['#38bdf8', '#0284c7'],
            pipeCap: '#a5f3fc',
            pipeBorder: 'rgba(165, 243, 252, 0.6)'
        },
        {
            id: 'ocean',
            name: 'Deep Ocean',
            desc: 'Subsurface sunbeams, coral reefs, and rising air bubbles.',
            weather: 'bubbles',
            skyColors: ['#082f49', '#0369a1', '#0284c7'],
            groundColor: '#082f49',
            pipeGrad: ['#06b6d4', '#0891b2'],
            pipeCap: '#67e8f9',
            pipeBorder: 'rgba(103, 232, 249, 0.5)'
        },
        {
            id: 'pixel',
            name: 'Retro Pixel World',
            desc: 'Chiptune brick ground and retro block clouds.',
            weather: 'none',
            skyColors: ['#60a5fa', '#93c5fd', '#bfdbfe'],
            groundColor: '#b45309',
            pipeGrad: ['#84cc16', '#65a30d'],
            pipeCap: '#4d7c0f',
            pipeBorder: '#000000'
        },
        {
            id: 'space',
            name: 'Cosmic Space',
            desc: 'Twinkling multi-layer starfield and distant glowing planets.',
            weather: 'none',
            skyColors: ['#000000', '#090a0f', '#17132a'],
            groundColor: '#0a0a14',
            pipeGrad: ['#892cdc', '#4c1d95'],
            pipeCap: '#c084fc',
            pipeBorder: 'rgba(192, 132, 252, 0.6)'
        },
        {
            id: 'rain',
            name: 'Rainy Cyberpunk',
            desc: 'Wet asphalt reflections, misty skyline, and gentle rainfall.',
            weather: 'rain',
            skyColors: ['#0f172a', '#1e293b', '#334155'],
            groundColor: '#090d16',
            pipeGrad: ['#38bdf8', '#0284c7'],
            pipeCap: '#f43f5e',
            pipeBorder: 'rgba(244, 63, 94, 0.6)'
        },
        {
            id: 'snow',
            name: 'Winter Snowstorm',
            desc: 'Cozy snowy pine village with falling snowflakes.',
            weather: 'snow',
            skyColors: ['#1e293b', '#334155', '#475569'],
            groundColor: '#e2e8f0',
            pipeGrad: ['#94a3b8', '#64748b'],
            pipeCap: '#f8fafc',
            pipeBorder: 'rgba(255, 255, 255, 0.8)'
        },
        {
            id: 'desert',
            name: 'Golden Desert',
            desc: 'Rolling sunlit sand dunes and distant ancient pyramids.',
            weather: 'none',
            skyColors: ['#f59e0b', '#fbbf24', '#fde68a'],
            groundColor: '#d97706',
            pipeGrad: ['#b45309', '#92400e'],
            pipeCap: '#fde68a',
            pipeBorder: 'rgba(253, 230, 138, 0.6)'
        }
    ];

    function getTheme(id) {
        return THEMES_LIST.find(t => t.id === id) || THEMES_LIST[0];
    }

    function getAllThemes() {
        return THEMES_LIST;
    }

    function renderParallax(ctx, theme, width, height, scrollX, groundHeight) {
        ctx.save();

        const skyGrad = ctx.createLinearGradient(0, 0, 0, height - groundHeight);
        theme.skyColors.forEach((col, idx) => {
            skyGrad.addColorStop(idx / (theme.skyColors.length - 1), col);
        });
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height - groundHeight);

        if (theme.id === 'sunset') {
            const sunY = (height - groundHeight) * 0.45;
            const sunR = Math.min(width, height) * 0.22;
            const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
            sunGrad.addColorStop(0, '#fef08a');
            sunGrad.addColorStop(0.5, '#f43f5e');
            sunGrad.addColorStop(1, '#a21caf');
            ctx.fillStyle = sunGrad;
            ctx.beginPath();
            ctx.arc(width * 0.5, sunY, sunR, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = theme.skyColors[1];
            for (let i = 0; i < 7; i++) {
                const blindY = sunY + (i * (sunR / 7));
                const h = 2 + i * 1.5;
                ctx.fillRect(width * 0.5 - sunR, blindY, sunR * 2, h);
            }
        } else if (theme.id === 'space') {
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 60; i++) {
                const x = ((i * 137.5) + (scrollX * 0.05)) % width;
                const y = ((i * 89.3)) % (height - groundHeight);
                const size = (i % 3) + 1;
                ctx.globalAlpha = 0.4 + (Math.sin(i + scrollX * 0.02) * 0.4);
                ctx.fillRect(x < 0 ? x + width : x, y, size, size);
            }
            ctx.globalAlpha = 1.0;
        } else if (theme.id === 'mountains') {
            ctx.save();
            ctx.globalAlpha = 0.35;
            const auroraGrad = ctx.createLinearGradient(0, 40, 0, 180);
            auroraGrad.addColorStop(0, 'rgba(0, 240, 144, 0.8)');
            auroraGrad.addColorStop(0.5, 'rgba(0, 242, 254, 0.5)');
            auroraGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = auroraGrad;
            ctx.beginPath();
            ctx.moveTo(0, 80);
            for (let x = 0; x <= width; x += 30) {
                const y = 80 + Math.sin((x + scrollX * 0.5) * 0.01) * 35;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(width, 0);
            ctx.lineTo(0, 0);
            ctx.fill();
            ctx.restore();
        }

        const distantOffset = (scrollX * 0.12) % width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.moveTo(0, height - groundHeight);
        for (let x = 0; x <= width + 100; x += 80) {
            const worldX = x + distantOffset;
            const hillH = 90 + Math.sin(worldX * 0.008) * 45;
            ctx.lineTo(x, height - groundHeight - hillH);
        }
        ctx.lineTo(width, height - groundHeight);
        ctx.fill();

        const midOffset = (scrollX * 0.35) % 120;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        for (let x = -midOffset; x < width + 120; x += 110) {
            const h = 50 + Math.sin(x * 0.05) * 20;
            ctx.fillRect(x, height - groundHeight - h, 70, h);
        }

        ctx.fillStyle = theme.groundColor;
        ctx.fillRect(0, height - groundHeight, width, groundHeight);

        ctx.strokeStyle = theme.pipeBorder;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, height - groundHeight);
        ctx.lineTo(width, height - groundHeight);
        ctx.stroke();

        const stripeOffset = scrollX % 30;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        for (let x = -stripeOffset; x < width + 30; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, height - groundHeight);
            ctx.lineTo(x + 15, height);
            ctx.lineTo(x + 5, height);
            ctx.lineTo(x - 10, height - groundHeight);
            ctx.fill();
        }

        ctx.restore();
    }

    return {
        getTheme,
        getAllThemes,
        renderParallax
    };
})();
