/**
 * FLAPPY WYZUK - BIRD CHARACTERS & PROCEDURAL VECTOR SPRITES
 * Author: Wyzuk (https://github.com/wyzuk)
 * Repository: https://github.com/wyzuk/flappy
 */

const BirdsManager = (() => {
    const BIRD_LIST = [
        {
            id: 'gold',
            name: 'Classic Gold',
            desc: 'The iconic golden flapper with classic agile wings.',
            primaryColor: '#ffbe0b',
            secondaryColor: '#fb5607',
            accentColor: '#ffffff',
            trailType: 'spark'
        },
        {
            id: 'cyber',
            name: 'Cyber Cyan',
            desc: 'Futuristic mecha bird equipped with neon ion thrusters.',
            primaryColor: '#00f2fe',
            secondaryColor: '#4facfe',
            accentColor: '#00e1ff',
            trailType: 'spark'
        },
        {
            id: 'crimson',
            name: 'Crimson Phoenix',
            desc: 'A fiery aviator radiating embers and fierce energy.',
            primaryColor: '#ff2a7a',
            secondaryColor: '#d90429',
            accentColor: '#ffe066',
            trailType: 'spark'
        },
        {
            id: 'emerald',
            name: 'Emerald Dragon',
            desc: 'Infused with ancient woodland jade magic.',
            primaryColor: '#00f090',
            secondaryColor: '#059669',
            accentColor: '#a7f3d0',
            trailType: 'spark'
        },
        {
            id: 'purple',
            name: 'Vaporwave Neon',
            desc: 'A stylish synthwave pilot soaked in retro aesthetic vibes.',
            primaryColor: '#892cdc',
            secondaryColor: '#52057b',
            accentColor: '#ff70a6',
            trailType: 'spark'
        },
        {
            id: 'shadow',
            name: 'Shadow Stealth',
            desc: 'Blacked-out phantom flapper with a focused red sensor.',
            primaryColor: '#2b2d42',
            secondaryColor: '#121420',
            accentColor: '#ef233c',
            trailType: 'smoke'
        },
        {
            id: 'white',
            name: 'Celestial Angel',
            desc: 'Blessed with a radiant halo and pure white feathers.',
            primaryColor: '#edf2f4',
            secondaryColor: '#8d99ae',
            accentColor: '#ffd166',
            trailType: 'spark'
        },
        {
            id: 'orange',
            name: 'Solar Flare',
            desc: 'Ignited by solar winds and blazing cosmic heat.',
            primaryColor: '#f77f00',
            secondaryColor: '#d62828',
            accentColor: '#fcbf49',
            trailType: 'spark'
        },
        {
            id: 'pink',
            name: 'Sakura Blossom',
            desc: 'Gentle pastel flight accompanied by floating petals.',
            primaryColor: '#ff9ebb',
            secondaryColor: '#ff5c8d',
            accentColor: '#ffffff',
            trailType: 'spark'
        },
        {
            id: 'cyan',
            name: 'Aurora Frost',
            desc: 'Glacial cryo-bird crowned with northern light shimmer.',
            primaryColor: '#a2d2ff',
            secondaryColor: '#0077b6',
            accentColor: '#e0fbfc',
            trailType: 'spark'
        },
        {
            id: 'galaxy',
            name: 'Cosmic Void',
            desc: 'Infused with dark matter and twinkling stellar energy.',
            primaryColor: '#3a0ca3',
            secondaryColor: '#4361ee',
            accentColor: '#4cc9f0',
            trailType: 'spark'
        },
        {
            id: 'pixel',
            name: 'Retro 8-Bit',
            desc: 'Chiptune nostalgia straight out of 1989 arcade consoles.',
            primaryColor: '#e63946',
            secondaryColor: '#1d3557',
            accentColor: '#f1faee',
            trailType: 'spark'
        }
    ];

    function getBird(id) {
        return BIRD_LIST.find(b => b.id === id) || BIRD_LIST[0];
    }

    function getAllBirds() {
        return BIRD_LIST;
    }

    function drawBird(ctx, bird, x, y, angle = 0, flapPhase = 0, isDead = false) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        const wingFlapOffset = Math.sin(flapPhase) * 6;

        if (bird.id === 'white') {
            ctx.save();
            ctx.strokeStyle = '#ffd166';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#ffd166';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.ellipse(0, -18, 12, 4, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        if (bird.id === 'emerald') {
            ctx.fillStyle = '#059669';
            ctx.beginPath();
            ctx.moveTo(-4, -10);
            ctx.lineTo(-8, -18);
            ctx.lineTo(2, -12);
            ctx.fill();
        }

        ctx.save();
        const bodyGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, 16);
        bodyGrad.addColorStop(0, bird.primaryColor);
        bodyGrad.addColorStop(1, bird.secondaryColor);

        ctx.fillStyle = bodyGrad;
        ctx.shadowColor = bird.primaryColor;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        if (bird.id === 'pixel') {
            ctx.fillRect(-15, -12, 28, 24);
        } else {
            ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.ellipse(2, 4, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(8, -4, 5.5, 0, Math.PI * 2);
        ctx.fill();

        if (isDead) {
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(6, -6);
            ctx.lineTo(10, -2);
            ctx.moveTo(10, -6);
            ctx.lineTo(6, -2);
            ctx.stroke();
        } else if (bird.id === 'shadow') {
            ctx.fillStyle = '#ff2a7a';
            ctx.shadowColor = '#ff2a7a';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(9, -4, 2.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#111111';
            ctx.beginPath();
            ctx.arc(9, -4, 2.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(10, -5, 1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        ctx.fillStyle = bird.accentColor || '#fb5607';
        ctx.beginPath();
        ctx.moveTo(14, -2);
        ctx.lineTo(24, 1);
        ctx.lineTo(14, 5);
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.translate(-4, 0);
        ctx.fillStyle = bird.secondaryColor;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        if (bird.id === 'pixel') {
            ctx.fillRect(-8, wingFlapOffset - 4, 12, 8);
        } else {
            ctx.ellipse(-2, wingFlapOffset, 8, 5, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();

        ctx.restore();
    }

    function renderPreview(canvas, birdId) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const bird = getBird(birdId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBird(ctx, bird, canvas.width / 2, canvas.height / 2, 0, 0, false);
    }

    return {
        getBird,
        getAllBirds,
        drawBird,
        renderPreview
    };
})();
