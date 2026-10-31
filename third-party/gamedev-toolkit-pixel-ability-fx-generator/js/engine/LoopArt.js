// A phase-based renderer: every animated value is a function of an angle that
// completes an integer number of turns. No particle is born or dies at the seam.
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export const LOOP_MOTIF_GROUPS = [
    { label: 'Original', motifs: {
        mandala: 'Petal mandala', sigil: 'Arcane sigil', orbit: 'Orbital rings',
        spiral: 'Spiral vortex', prism: 'Turning prism', lightning: 'Branch lightning',
        waves: 'Wave flower', plasma: 'Plasma halo'
    } },
    { label: 'Celestial', motifs: {
        starburst: 'Starburst', sunwheel: 'Sun wheel', eclipse: 'Eclipse',
        blackhole: 'Black hole', comet: 'Comet', nova: 'Nova shockwave'
    } },
    { label: 'Runes & portals', motifs: {
        pentagram: 'Pentagram', hexagram: 'Hexagram', runicCross: 'Runic cross',
        clockwork: 'Clockwork seal', radar: 'Radar sweep', portal: 'Portal gate'
    } },
    { label: 'Crystals & blades', motifs: {
        tetrahedron: 'Tetrahedron', octahedron: 'Octahedron', crystalBloom: 'Crystal bloom',
        crystalCage: 'Crystal cage', shuriken: 'Shuriken', bladeWheel: 'Blade wheel'
    } },
    { label: 'Organic', motifs: {
        daisy: 'Daisy', rose: 'Rose spiral', lotus: 'Lotus',
        leafVortex: 'Leaf vortex', vine: 'Vine', thornRing: 'Thorn ring'
    } },
    { label: 'Elements', motifs: {
        fire: 'Fire plume', smoke: 'Smoke curl', waterfall: 'Waterfall',
        rain: 'Rain veil', aurora: 'Aurora', tide: 'Tidal bands'
    } },
    { label: 'Motion & space', motifs: {
        helix: 'Helix', dna: 'DNA strand', tunnel: 'Tunnel',
        lissajous: 'Lissajous knot', infinity: 'Infinity loop', hourglass: 'Hourglass'
    } },
    { label: 'Arcade & particles', motifs: {
        glitch: 'Glitch burst', lattice: 'Lattice', checker: 'Checker pulse',
        sparks: 'Spark shower', chain: 'Chain links', meteorRain: 'Meteor rain'
    } }
];

export const LOOP_MOTIFS = Object.assign({}, ...LOOP_MOTIF_GROUPS.map((group) => group.motifs));

const randomFromSeed = (seed) => {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
};

const dot = (context, x, y, size, color, alpha = 1) => {
    const width = Math.max(1, Math.round(size));
    const px = clamp(Math.round(x - width / 2), 3, 156 - width);
    const py = clamp(Math.round(y - width / 2), 3, 156 - width);
    context.globalAlpha = clamp(alpha, 0, 1);
    context.fillStyle = color;
    context.fillRect(px, py, width, width);
};

const mark = (context, x, y, size, color, alpha, shape) => {
    if (shape === 'diamond' || shape === 'shard' || shape === 'chevron') {
        dot(context, x, y - size, size, color, alpha);
        dot(context, x - size, y, size, color, alpha);
        dot(context, x + size, y, size, color, alpha);
        dot(context, x, y + size, size, color, alpha);
    } else if (shape === 'spark' || shape === 'star' || shape === 'cross') {
        dot(context, x, y, size + 1, color, alpha);
        dot(context, x - size * 2, y, 1, color, alpha * 0.8);
        dot(context, x + size * 2, y, 1, color, alpha * 0.8);
        dot(context, x, y - size * 2, 1, color, alpha * 0.8);
        dot(context, x, y + size * 2, 1, color, alpha * 0.8);
    } else {
        dot(context, x, y, size, color, alpha);
    }
};

const line = (context, ax, ay, bx, by, color, alpha = 1, size = 2, gaps = false) => {
    const length = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(length / 1.5));
    for (let index = 0; index <= steps; index += 1) {
        if (gaps && Math.floor(index / 5) % 4 === 3) continue;
        const t = index / steps;
        dot(context, ax + (bx - ax) * t, ay + (by - ay) * t, size, color, alpha);
    }
};

const curve = (context, count, pointAt, color, alpha, size, gaps = false) => {
    for (let index = 0; index < count; index += 1) {
        if (gaps && Math.floor(index / 8) % 5 === 4) continue;
        const point = pointAt(index / count);
        dot(context, point.x, point.y, size, color, alpha);
    }
};

const polar = (angle, radius) => ({ x: 80 + Math.cos(angle) * radius, y: 80 + Math.sin(angle) * radius });
const colors = (recipe) => recipe.palette;
const turns = (recipe) => (recipe.direction || 1) * (recipe.loopTurns || 1);
const points = (recipe) => clamp(Math.round(recipe.symmetry || 6), 3, 12);
const motifRadius = (recipe) => clamp((recipe.radius || 55) * (recipe.scale || 1) * 0.77, 31, 57);
const pulse = (recipe, angle) => {
    const style = recipe.temporalStyle;
    if (style === 'double-pulse') return 0.78 + 0.22 * Math.cos(angle * 2);
    if (style === 'staggered') return 0.82 + 0.18 * Math.sin(angle * 3);
    if (style === 'echo') return 0.86 + 0.14 * Math.cos(angle * 3);
    if (style === 'slow-build') return 0.66 + 0.34 * (0.5 - 0.5 * Math.cos(angle));
    return 0.84 + 0.16 * Math.cos(angle);
};

const polygon = (context, sides, radius, rotation, color, alpha, size, gaps = false) => {
    for (let side = 0; side < sides; side += 1) {
        const a = polar(rotation + side * TAU / sides, radius);
        const b = polar(rotation + (side + 1) * TAU / sides, radius);
        line(context, a.x, a.y, b.x, b.y, color, alpha, size, gaps);
    }
};

const drawMandala = (context, recipe, angle) => {
    const c = colors(recipe);
    const petals = points(recipe);
    const radius = motifRadius(recipe);
    const spin = angle * turns(recipe);
    const breath = pulse(recipe, angle);
    for (let layer = 0; layer < 2; layer += 1) {
        const base = radius * (layer ? 0.56 : 1);
        curve(context, 260, (unit) => {
            const theta = unit * TAU + spin * (layer ? -1 : 1) + recipe.tilt;
            return polar(theta, base * (0.63 + 0.37 * Math.cos(theta * petals - spin * (petals + (layer ? 1 : 0)))) * breath);
        }, c[layer ? 2 : 1], layer ? 0.72 : 0.9, layer ? 1 : 2);
    }
    for (let petal = 0; petal < petals; petal += 1) {
        const theta = petal * TAU / petals + spin + recipe.tilt;
        const tip = polar(theta, radius * 0.91 * breath);
        mark(context, tip.x, tip.y, 2, c[0], 0.96, recipe.particleShapes?.[0]);
    }
    polygon(context, petals, radius * 0.22, -spin, c[3], 0.8, 2);
    mark(context, 80, 80, 3, c[0], 1, 'spark');
};

const drawSigil = (context, recipe, angle) => {
    const c = colors(recipe);
    const sides = points(recipe);
    const radius = motifRadius(recipe);
    const spin = angle * turns(recipe);
    polygon(context, sides, radius, spin + recipe.tilt, c[1], 0.9, 2, recipe.traceStyle === 'dashes');
    polygon(context, sides, radius * 0.68, -spin + recipe.tilt, c[2], 0.72, 1);
    polygon(context, Math.max(3, Math.round(sides / 2)), radius * 0.34, spin, c[0], 0.9, 2);
    for (let index = 0; index < sides; index += 1) {
        const theta = index * TAU / sides + spin + recipe.tilt;
        const inside = polar(theta, radius * 0.73);
        const outside = polar(theta, radius * 0.89);
        line(context, inside.x, inside.y, outside.x, outside.y, c[3], 0.72, 1);
        const tip = polar(theta, radius);
        mark(context, tip.x, tip.y, 2, c[0], 0.95, 'diamond');
    }
    mark(context, 80, 80, 3, c[0], 1, 'spark');
};

const drawOrbit = (context, recipe, angle) => {
    const c = colors(recipe);
    const radius = motifRadius(recipe);
    for (let ring = 0; ring < 3; ring += 1) {
        const tilt = ring * Math.PI / 3 + recipe.tilt;
        const flat = ring === 1 ? 0.36 : 0.53;
        curve(context, 165, (unit) => {
            const theta = unit * TAU;
            const x = Math.cos(theta) * radius;
            const y = Math.sin(theta) * radius * flat;
            return {
                x: 80 + x * Math.cos(tilt) - y * Math.sin(tilt),
                y: 80 + x * Math.sin(tilt) + y * Math.cos(tilt)
            };
        }, c[ring % 2 + 1], 0.68 + ring * 0.1, ring === 1 ? 2 : 1, recipe.traceStyle === 'dashes');
        const satellite = angle * turns(recipe) * (ring % 2 ? -1 : 1) + ring * TAU / 3;
        const x = Math.cos(satellite) * radius;
        const y = Math.sin(satellite) * radius * flat;
        mark(context, 80 + x * Math.cos(tilt) - y * Math.sin(tilt), 80 + x * Math.sin(tilt) + y * Math.cos(tilt), 3, c[0], 1, 'diamond');
    }
    polygon(context, 6, 10 + 2 * Math.sin(angle), -angle, c[2], 0.9, 2);
    mark(context, 80, 80, 3, c[0], 1, 'spark');
};

const drawSpiral = (context, recipe, angle) => {
    const c = colors(recipe);
    const arms = clamp(Math.round(points(recipe) / 2), 3, 6);
    const radius = motifRadius(recipe);
    for (let arm = 0; arm < arms; arm += 1) {
        for (let trace = 0; trace < 2; trace += 1) {
            curve(context, 95, (unit) => {
                const theta = angle * turns(recipe) + arm * TAU / arms + unit * TAU * 1.55 + trace * 0.16;
                return polar(theta + recipe.tilt, 5 + unit * radius * (trace ? 0.87 : 1));
            }, c[(arm + trace + 1) % c.length], (trace ? 0.45 : 0.82) * (0.68 + 0.32 * pulse(recipe, angle)), trace ? 1 : 2);
        }
    }
    mark(context, 80, 80, 4, c[0], 1, 'diamond');
};

const rotateProject = (point, angle, tilt, radius) => {
    const cy = Math.cos(angle);
    const sy = Math.sin(angle);
    const x = point[0] * cy + point[2] * sy;
    const z = -point[0] * sy + point[2] * cy;
    const y = point[1] * Math.cos(tilt) - z * Math.sin(tilt);
    return { x: 80 + x * radius, y: 80 + y * radius };
};

const drawPrism = (context, recipe, angle) => {
    const c = colors(recipe);
    const cube = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z])));
    const radius = motifRadius(recipe) * 0.54;
    const projected = cube.map((point) => rotateProject(point, angle * turns(recipe) + recipe.tilt, 0.48 + 0.12 * Math.sin(angle), radius));
    for (let first = 0; first < cube.length; first += 1) {
        for (let second = first + 1; second < cube.length; second += 1) {
            const differing = cube[first].filter((coordinate, index) => coordinate !== cube[second][index]).length;
            if (differing !== 1) continue;
            line(context, projected[first].x, projected[first].y, projected[second].x, projected[second].y,
                c[(first + second) % 2 + 1], 0.9, 2, recipe.traceStyle === 'dashes');
        }
        mark(context, projected[first].x, projected[first].y, 2, c[0], 0.95, 'diamond');
    }
    const innerRadius = radius * 0.45;
    const inner = cube.map((point) => rotateProject(point, -angle * turns(recipe), 0.6, innerRadius));
    for (let first = 0; first < cube.length; first += 1) {
        for (let second = first + 1; second < cube.length; second += 1) {
            if (cube[first].filter((coordinate, index) => coordinate !== cube[second][index]).length === 1) {
                line(context, inner[first].x, inner[first].y, inner[second].x, inner[second].y, c[0], 0.48, 1);
            }
        }
    }
};

const drawLightning = (context, recipe, angle) => {
    const c = colors(recipe);
    const branches = clamp(Math.round(points(recipe) / 2) + 2, 5, 7);
    const radius = motifRadius(recipe);
    for (let branch = 0; branch < branches; branch += 1) {
        const base = branch * TAU / branches + recipe.tilt;
        let previous = polar(base, 5);
        for (let segment = 1; segment <= 13; segment += 1) {
            const distance = segment / 13 * radius;
            const sideways = Math.sin(segment * 2.7 + branch * 7 + angle * 2) * (2 + segment * 0.34);
            const next = polar(base + sideways / Math.max(8, distance), distance);
            line(context, previous.x, previous.y, next.x, next.y, c[segment % 3], 0.75 + 0.22 * pulse(recipe, angle + branch), 2);
            if (segment === 7 || segment === 10) {
                const fork = polar(base + (branch % 2 ? -1 : 1) * 0.42 + Math.sin(angle + segment) * 0.12, distance + 12);
                line(context, next.x, next.y, fork.x, fork.y, c[1], 0.78, 2);
            }
            previous = next;
        }
        mark(context, previous.x, previous.y, 2, c[0], 0.9, 'spark');
    }
    mark(context, 80, 80, 4, c[0], 1, 'spark');
};

const drawWaves = (context, recipe, angle) => {
    const c = colors(recipe);
    const petals = points(recipe);
    const radius = motifRadius(recipe);
    for (let ring = 0; ring < 3; ring += 1) {
        curve(context, 230, (unit) => {
            const theta = unit * TAU + recipe.tilt;
            const ripple = Math.sin(theta * petals + angle * turns(recipe) + ring * 0.8);
            const distance = radius * (0.52 + ring * 0.18) + ripple * (6 + ring * 2);
            return polar(theta, distance);
        }, c[(ring + 1) % c.length], 0.58 + ring * 0.12, ring === 2 ? 2 : 1);
    }
    polygon(context, petals, radius * 0.22, angle * turns(recipe), c[0], 0.75, 2);
};

const drawPlasma = (context, recipe, angle) => {
    const c = colors(recipe);
    const radius = motifRadius(recipe);
    const random = randomFromSeed(recipe.seed ^ 0xb4ea98f2);
    for (let index = 0; index < 220; index += 1) {
        const theta = random() * TAU;
        const base = Math.sqrt(random());
        const warp = Math.sin(theta * 5 + angle * turns(recipe)) * 4 + Math.cos(theta * 9 - angle * 2) * 3;
        const distance = 12 + base * (radius - 12) + warp;
        const point = polar(theta + angle * turns(recipe) * (index % 2 ? 1 : -1), distance);
        const flicker = 0.5 + 0.5 * Math.sin(angle * (index % 3 + 1) + index * 1.7);
        dot(context, point.x, point.y, index % 7 === 0 ? 3 : 2, c[index % 3], 0.34 + 0.6 * flicker);
    }
    curve(context, 180, (unit) => {
        const theta = unit * TAU;
        return polar(theta, 13 + Math.sin(theta * 6 + angle) * 2);
    }, c[3], 0.75, 2);
};

const ring = (context, radius, color, alpha = 0.8, size = 2, wave = 0, lobes = 1, phase = 0) => {
    curve(context, Math.max(100, Math.round(radius * 4)), (unit) => {
        const theta = unit * TAU;
        return polar(theta, radius + Math.sin(theta * lobes + phase) * wave);
    }, color, alpha, size);
};

const ellipse = (context, cx, cy, rx, ry, rotation, color, alpha = 0.8, size = 2, start = 0, end = TAU) => {
    curve(context, Math.max(40, Math.round((rx + ry) * 2)), (unit) => {
        const theta = start + unit * (end - start);
        const x = Math.cos(theta) * rx;
        const y = Math.sin(theta) * ry;
        return {
            x: cx + x * Math.cos(rotation) - y * Math.sin(rotation),
            y: cy + x * Math.sin(rotation) + y * Math.cos(rotation)
        };
    }, color, alpha, size);
};

const rotate = (x, y, angle) => ({
    x: 80 + x * Math.cos(angle) - y * Math.sin(angle),
    y: 80 + x * Math.sin(angle) + y * Math.cos(angle)
});

const drawStarburst = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    const rays = 12;
    for (let i = 0; i < rays; i += 1) {
        const theta = i * TAU / rays + spin;
        const length = r * (i % 2 ? 0.72 : 1) * (0.9 + 0.1 * Math.cos(angle * 2 + i));
        const a = polar(theta, 10); const b = polar(theta, length);
        line(ctx, a.x, a.y, b.x, b.y, c[i % 3], 0.88, i % 2 ? 1 : 2);
        mark(ctx, b.x, b.y, 2, c[0], 0.98, 'spark');
    }
    ring(ctx, 12, c[1], 0.9, 2);
    mark(ctx, 80, 80, 4, c[0], 1, 'spark');
};

const drawSunwheel = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    ring(ctx, r * 0.48, c[0], 0.94, 2);
    ring(ctx, r * 0.33, c[2], 0.8, 2);
    for (let flame = 0; flame < 10; flame += 1) {
        curve(ctx, 28, (unit) => {
            const theta = flame * TAU / 10 + spin + unit * 0.5;
            return polar(theta, r * (0.48 + unit * 0.48));
        }, c[flame % 2 + 1], 0.88, 2);
    }
    mark(ctx, 80, 80, 5, c[0], 1, 'diamond');
};

const drawEclipse = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe) * 0.68;
    for (let y = -r; y <= r; y += 3) for (let x = -r; x <= r; x += 3) {
        if (x * x + y * y < r * r) dot(ctx, 80 + x, 80 + y, 3, c[4], 0.82);
    }
    ring(ctx, r + 3, c[0], 0.95, 3, 2, 9, angle);
    ring(ctx, r + 11, c[1], 0.55, 1, 3, 13, -angle);
    const glint = polar(angle * turns(recipe), r + 3);
    mark(ctx, glint.x, glint.y, 3, c[0], 1, 'spark');
};

const drawBlackhole = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    ellipse(ctx, 80, 80, r, r * 0.32, recipe.tilt, c[1], 0.86, 3);
    ellipse(ctx, 80, 80, r * 0.75, r * 0.23, recipe.tilt, c[0], 0.7, 1);
    ring(ctx, r * 0.26, c[3], 0.9, 3);
    for (let arm = 0; arm < 2; arm += 1) {
        curve(ctx, 110, (unit) => polar(spin + arm * Math.PI + unit * TAU * 1.7, 5 + unit * r * 0.85), c[arm + 1], 0.75, 2);
    }
    dot(ctx, 80, 80, 12, c[4], 1);
};

const drawComet = (ctx, recipe, angle) => {
    const c = colors(recipe); const t = angle * turns(recipe);
    const head = { x: 80 + Math.cos(t) * 23, y: 80 + Math.sin(t) * 16 };
    const vx = -Math.sin(t); const vy = Math.cos(t);
    for (let trail = 0; trail < 4; trail += 1) {
        curve(ctx, 90, (unit) => ({
            x: head.x - vx * unit * (43 + trail * 7) + Math.cos(t) * Math.sin(unit * Math.PI) * trail * 4,
            y: head.y - vy * unit * (43 + trail * 7) + Math.sin(t) * Math.sin(unit * Math.PI) * trail * 4
        }), c[trail % 3], 0.9 - trail * 0.13, trail ? 1 : 3);
    }
    mark(ctx, head.x, head.y, 6, c[0], 1, 'spark');
    ellipse(ctx, head.x, head.y, 8, 8, 0, c[1], 0.85, 2);
};

const drawNova = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe);
    for (let wave = 0; wave < 3; wave += 1) {
        const radius = r * (0.35 + wave * 0.23) + Math.sin(angle + wave * TAU / 3) * 5;
        ring(ctx, radius, c[wave], 0.75 + wave * 0.05, wave === 0 ? 3 : 2, 2, 12, angle + wave);
    }
    for (let ray = 0; ray < 16; ray += 1) {
        const theta = ray * TAU / 16 + recipe.tilt;
        const a = polar(theta, r * 0.73); const b = polar(theta, r * (0.93 + 0.06 * Math.sin(angle * 2 + ray)));
        line(ctx, a.x, a.y, b.x, b.y, c[ray % 3], 0.75, 1);
    }
    mark(ctx, 80, 80, 5, c[0], 1, 'spark');
};

const drawPentagram = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    ring(ctx, r, c[2], 0.58, 1);
    const vertices = Array.from({ length: 5 }, (_, i) => polar(-Math.PI / 2 + i * TAU / 5 + spin, r * 0.88));
    for (let i = 0; i < 5; i += 1) {
        const a = vertices[i]; const b = vertices[(i + 2) % 5];
        line(ctx, a.x, a.y, b.x, b.y, c[1], 0.9, 2);
        mark(ctx, a.x, a.y, 2, c[0], 1, 'diamond');
    }
    ring(ctx, r * 0.26, c[0], 0.56, 1);
};

const drawHexagram = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    polygon(ctx, 3, r * 0.82, spin - Math.PI / 2, c[1], 0.9, 2);
    polygon(ctx, 3, r * 0.82, -spin + Math.PI / 2, c[0], 0.84, 2);
    ring(ctx, r * 0.43, c[2], 0.66, 1);
    for (let i = 0; i < 6; i += 1) {
        const p = polar(i * TAU / 6 + spin, r);
        mark(ctx, p.x, p.y, 2, c[0], 0.9, 'spark');
    }
};

const drawRunicCross = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    for (let arm = 0; arm < 4; arm += 1) {
        const theta = arm * Math.PI / 2 + spin;
        const a = polar(theta, 12); const b = polar(theta, r);
        line(ctx, a.x, a.y, b.x, b.y, c[1], 0.95, 3);
        for (let tick = 1; tick <= 3; tick += 1) {
            const center = polar(theta, 15 + tick * 11);
            const dx = Math.cos(theta + Math.PI / 2) * (tick % 2 ? 6 : 4);
            const dy = Math.sin(theta + Math.PI / 2) * (tick % 2 ? 6 : 4);
            line(ctx, center.x - dx, center.y - dy, center.x + dx, center.y + dy, c[0], 0.75, 1);
        }
        mark(ctx, b.x, b.y, 2, c[0], 1, 'diamond');
    }
    polygon(ctx, 4, 12, -spin, c[2], 0.8, 2);
};

const drawClockwork = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    ring(ctx, r * 0.76, c[1], 0.86, 2);
    ring(ctx, r * 0.46, c[2], 0.75, 2);
    for (let tooth = 0; tooth < 16; tooth += 1) {
        const theta = tooth * TAU / 16 + spin;
        const a = polar(theta, r * 0.72); const b = polar(theta, r * 0.91);
        line(ctx, a.x, a.y, b.x, b.y, c[tooth % 2], 0.86, 3);
    }
    const hand = polar(spin, r * 0.38); const short = polar(-spin * 2, r * 0.25);
    line(ctx, 80, 80, hand.x, hand.y, c[0], 1, 2);
    line(ctx, 80, 80, short.x, short.y, c[1], 0.9, 2);
    mark(ctx, 80, 80, 3, c[0], 1, 'diamond');
};

const drawRadar = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    for (const scale of [0.34, 0.64, 0.95]) ring(ctx, r * scale, c[2], 0.5 + scale * 0.3, 1);
    line(ctx, 80 - r, 80, 80 + r, 80, c[3], 0.6, 1);
    line(ctx, 80, 80 - r, 80, 80 + r, c[3], 0.6, 1);
    for (let beam = 0; beam < 5; beam += 1) {
        const p = polar(spin - beam * 0.08, r * (0.98 - beam * 0.07));
        line(ctx, 80, 80, p.x, p.y, c[beam % 2], 0.86 - beam * 0.12, 1);
    }
    for (let i = 0; i < 3; i += 1) {
        const p = polar(i * 2.1 + recipe.tilt, r * (0.4 + i * 0.17));
        mark(ctx, p.x, p.y, 2, c[0], 0.5 + 0.5 * Math.sin(angle + i), 'spark');
    }
};

const drawPortal = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    for (let layer = 0; layer < 3; layer += 1) {
        ellipse(ctx, 80, 80, r * (0.4 + layer * 0.15), r * (0.94 - layer * 0.07),
            Math.sin(angle + layer) * 0.12, c[layer], 0.88 - layer * 0.14, 2);
    }
    for (let i = 0; i < 8; i += 1) {
        const theta = i * TAU / 8 + spin;
        const x = 80 + Math.cos(theta) * r * 0.47;
        const y = 80 + Math.sin(theta) * r * 0.84;
        dot(ctx, x, y, 3, c[0], 0.85);
    }
    line(ctx, 80 - r * 0.45, 80 + r * 0.8, 80 + r * 0.45, 80 + r * 0.8, c[1], 0.85, 2);
};

const leaf = (ctx, cx, cy, direction, length, width, color, alpha = 0.85, size = 2) => {
    for (const side of [-1, 1]) {
        curve(ctx, 38, (unit) => {
            const along = (unit - 0.5) * length;
            const across = side * Math.sin(unit * Math.PI) * width;
            return {
                x: cx + along * Math.cos(direction) - across * Math.sin(direction),
                y: cy + along * Math.sin(direction) + across * Math.cos(direction)
            };
        }, color, alpha, size);
    }
};

const drawTetrahedron = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe) * 0.62;
    const vertices = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]]
        .map((p) => rotateProject(p, angle * turns(recipe) + recipe.tilt, 0.5, r));
    for (let i = 0; i < 4; i += 1) {
        for (let j = i + 1; j < 4; j += 1) line(ctx, vertices[i].x, vertices[i].y, vertices[j].x, vertices[j].y, c[(i + j) % 3], 0.84, 2);
        mark(ctx, vertices[i].x, vertices[i].y, 2, c[0], 1, 'diamond');
    }
};

const drawOctahedron = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe) * 0.67;
    const raw = [[0, -1.35, 0], [0, 1.35, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1]];
    const v = raw.map((p) => rotateProject(p, angle * turns(recipe), 0.28 + 0.22 * Math.sin(angle), r));
    for (let i = 2; i < 6; i += 1) {
        for (const apex of [0, 1]) line(ctx, v[i].x, v[i].y, v[apex].x, v[apex].y, c[i % 3], 0.86, 2);
        const next = 2 + (i - 1) % 4;
        line(ctx, v[i].x, v[i].y, v[next].x, v[next].y, c[1], 0.72, 1);
    }
    for (const point of v) mark(ctx, point.x, point.y, 2, c[0], 0.95, 'diamond');
};

const drawCrystalBloom = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    for (let shard = 0; shard < 9; shard += 1) {
        const theta = shard * TAU / 9 + spin;
        const inner = polar(theta, 10); const tip = polar(theta, r * (shard % 2 ? 0.8 : 1));
        const left = polar(theta - 0.15, r * 0.42); const right = polar(theta + 0.15, r * 0.42);
        line(ctx, inner.x, inner.y, left.x, left.y, c[2], 0.8, 1);
        line(ctx, left.x, left.y, tip.x, tip.y, c[0], 0.93, 2);
        line(ctx, tip.x, tip.y, right.x, right.y, c[1], 0.9, 2);
        line(ctx, right.x, right.y, inner.x, inner.y, c[2], 0.7, 1);
    }
    mark(ctx, 80, 80, 4, c[0], 1, 'diamond');
};

const drawCrystalCage = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    const top = polar(-Math.PI / 2 + spin, r); const bottom = polar(Math.PI / 2 + spin, r);
    const left = polar(Math.PI + spin, r * 0.72); const right = polar(spin, r * 0.72);
    const corners = [top, right, bottom, left];
    for (let i = 0; i < 4; i += 1) {
        const next = corners[(i + 1) % 4];
        line(ctx, corners[i].x, corners[i].y, next.x, next.y, c[1], 0.92, 2);
        line(ctx, corners[i].x, corners[i].y, 80, 80, c[0], 0.65, 1);
    }
    line(ctx, top.x, top.y, bottom.x, bottom.y, c[2], 0.55, 1);
    line(ctx, left.x, left.y, right.x, right.y, c[2], 0.55, 1);
    polygon(ctx, 4, r * 0.34, -spin, c[0], 0.88, 2);
};

const drawShuriken = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    const vertices = [];
    for (let i = 0; i < 8; i += 1) vertices.push(polar(i * TAU / 8 + spin, i % 2 ? r * 0.28 : r));
    for (let i = 0; i < vertices.length; i += 1) {
        const a = vertices[i]; const b = vertices[(i + 1) % vertices.length];
        line(ctx, a.x, a.y, b.x, b.y, c[i % 3], 0.9, 3);
    }
    ring(ctx, 9, c[0], 0.95, 2);
    dot(ctx, 80, 80, 4, c[4], 1);
};

const drawBladeWheel = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    for (let blade = 0; blade < 6; blade += 1) {
        curve(ctx, 65, (unit) => {
            const theta = blade * TAU / 6 + spin + unit * 0.72;
            return polar(theta, 12 + unit * (r - 12));
        }, c[blade % 3], 0.92, 3);
        const tip = polar(blade * TAU / 6 + spin + 0.72, r);
        mark(ctx, tip.x, tip.y, 2, c[0], 1, 'shard');
    }
    ring(ctx, 13, c[0], 0.9, 2);
};

const drawDaisy = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = Math.sin(angle) * 0.13;
    for (let petal = 0; petal < 8; petal += 1) {
        const theta = petal * TAU / 8 + spin;
        const center = polar(theta, r * 0.52);
        leaf(ctx, center.x, center.y, theta, r * 0.88, 8, c[petal % 2], 0.88, 2);
    }
    ring(ctx, 11, c[2], 0.95, 3);
    mark(ctx, 80, 80, 4, c[0], 1, 'spark');
};

const drawRose = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    for (let curl = 0; curl < 5; curl += 1) {
        curve(ctx, 95, (unit) => {
            const theta = curl * TAU / 5 + spin + unit * Math.PI * 1.2;
            return polar(theta, 4 + unit * r * (0.5 + curl * 0.08));
        }, c[curl % 3], 0.87, 2);
    }
    leaf(ctx, 47, 110, Math.PI * 0.72 + Math.sin(angle) * 0.12, 30, 10, c[2], 0.72, 2);
    leaf(ctx, 112, 107, Math.PI * 0.28 - Math.sin(angle) * 0.12, 30, 10, c[1], 0.72, 2);
};

const drawLotus = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const sway = Math.sin(angle) * 0.1;
    for (let layer = 0; layer < 2; layer += 1) {
        for (let petal = -3; petal <= 3; petal += 1) {
            const theta = -Math.PI / 2 + petal * (layer ? 0.28 : 0.36) + sway;
            const length = r * (layer ? 1.02 : 0.78);
            const base = { x: 80 + petal * 5, y: 95 + layer * 7 };
            leaf(ctx, base.x + Math.cos(theta) * length * 0.38, base.y + Math.sin(theta) * length * 0.38,
                theta, length, layer ? 8 : 12, c[(Math.abs(petal) + layer) % 3], 0.82, 2);
        }
    }
    line(ctx, 52, 110, 108, 110, c[0], 0.8, 2);
};

const drawLeafVortex = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    for (let i = 0; i < 11; i += 1) {
        const unit = (i + 1) / 11;
        const theta = spin + unit * TAU * 2.4;
        const center = polar(theta, 7 + unit * r);
        leaf(ctx, center.x, center.y, theta + Math.PI / 2, 12 + unit * 10, 4 + unit * 2, c[i % 3], 0.84, 2);
    }
    mark(ctx, 80, 80, 3, c[0], 0.9, 'spark');
};

const drawVine = (ctx, recipe, angle) => {
    const c = colors(recipe); const sway = Math.sin(angle * turns(recipe)) * 5;
    curve(ctx, 130, (unit) => ({ x: 80 + Math.sin(unit * TAU * 1.6 + angle) * 15 + sway * unit, y: 25 + unit * 110 }), c[2], 0.85, 2);
    for (let i = 0; i < 8; i += 1) {
        const unit = (i + 0.7) / 9;
        const y = 25 + unit * 110;
        const x = 80 + Math.sin(unit * TAU * 1.6 + angle) * 15 + sway * unit;
        const side = i % 2 ? -1 : 1;
        leaf(ctx, x + side * 12, y - 4, side > 0 ? -0.6 : Math.PI + 0.6, 27, 7, c[i % 2], 0.9, 2);
    }
};

const drawThornRing = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe) * 0.75; const spin = angle * turns(recipe);
    ring(ctx, r, c[2], 0.9, 3);
    ring(ctx, r * 0.7, c[1], 0.65, 1);
    for (let thorn = 0; thorn < 14; thorn += 1) {
        const theta = thorn * TAU / 14 + spin;
        const a = polar(theta - 0.1, r); const b = polar(theta + 0.1, r);
        const tip = polar(theta + 0.18, r + 13);
        line(ctx, a.x, a.y, tip.x, tip.y, c[thorn % 3], 0.9, 2);
        line(ctx, tip.x, tip.y, b.x, b.y, c[thorn % 3], 0.9, 2);
    }
};

const drawFire = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe);
    for (let flame = 0; flame < 9; flame += 1) {
        const baseX = 80 + (flame - 4) * 7;
        const height = r * (0.85 + (flame % 3) * 0.15);
        for (const side of [-1, 1]) {
            curve(ctx, 65, (unit) => ({
                x: baseX + side * (1 - unit) * (4 + flame % 3) + Math.sin(unit * 7 + angle * 2 + flame) * (3 + unit * 5),
                y: 121 - unit * height * 1.55
            }), c[flame % 3], 0.82, flame % 3 === 0 ? 3 : 2);
        }
    }
    line(ctx, 48, 121, 112, 121, c[0], 0.7, 2);
};

const drawSmoke = (ctx, recipe, angle) => {
    const c = colors(recipe);
    for (let plume = 0; plume < 5; plume += 1) {
        curve(ctx, 120, (unit) => ({
            x: 80 + (plume - 2) * 8 + Math.sin(unit * TAU * (1 + plume % 2) + angle + plume) * (5 + unit * 15),
            y: 125 - unit * 95 + Math.cos(angle + plume) * 3
        }), c[plume % 3], 0.48 + plume * 0.06, 2, true);
    }
    for (let i = 0; i < 5; i += 1) {
        const y = 36 + i * 13;
        ellipse(ctx, 80 + Math.sin(angle + i) * 8, y, 10 + i * 2, 5 + i, 0, c[i % 3], 0.4, 1);
    }
};

const drawWaterfall = (ctx, recipe, angle) => {
    const c = colors(recipe); const flow = angle * turns(recipe);
    for (let stream = 0; stream < 8; stream += 1) {
        const x = 52 + stream * 8;
        curve(ctx, 95, (unit) => ({
            x: x + Math.sin(unit * TAU * 2 + flow + stream) * 3,
            y: 30 + unit * 92
        }), c[stream % 3], 0.7, stream % 2 ? 1 : 2, true);
        for (let drop = 0; drop < 4; drop += 1) {
            const y = 35 + (drop * 23) + Math.sin(flow + stream + drop) * 7;
            dot(ctx, x + Math.sin(y * 0.12 + flow) * 3, y, 3, c[0], 0.85);
        }
    }
    ellipse(ctx, 80, 124, 41, 9, 0, c[1], 0.78, 2, 0, Math.PI);
    for (let i = 0; i < 9; i += 1) {
        const p = { x: 47 + i * 8, y: 120 - Math.abs(Math.sin(angle + i)) * 9 };
        dot(ctx, p.x, p.y, 2, c[0], 0.8);
    }
};

const drawRain = (ctx, recipe, angle) => {
    const c = colors(recipe);
    for (let i = 0; i < 32; i += 1) {
        const column = i % 8; const row = Math.floor(i / 8);
        const x = 42 + column * 11 + Math.sin(angle + row) * 4;
        const y = 39 + row * 25 + Math.sin(angle * 2 + i * 0.7) * 8;
        line(ctx, x + 3, y - 7, x - 2, y + 7, c[i % 3], 0.66 + 0.2 * Math.sin(angle + i), 2);
    }
    line(ctx, 43, 126, 117, 126, c[2], 0.56, 1);
};

const drawAurora = (ctx, recipe, angle) => {
    const c = colors(recipe);
    for (let curtain = 0; curtain < 5; curtain += 1) {
        curve(ctx, 150, (unit) => ({
            x: 34 + unit * 92,
            y: 38 + curtain * 13 + Math.sin(unit * TAU * 1.6 + angle + curtain * 0.55) * (9 + curtain * 2)
        }), c[curtain % 3], 0.7 - curtain * 0.07, curtain % 2 ? 1 : 2);
        for (let ray = 0; ray < 13; ray += 1) {
            const unit = ray / 12;
            const x = 34 + unit * 92;
            const y = 38 + curtain * 13 + Math.sin(unit * TAU * 1.6 + angle + curtain * 0.55) * (9 + curtain * 2);
            line(ctx, x, y, x, y + 6 + curtain * 2, c[curtain % 3], 0.23, 1);
        }
    }
};

const drawTide = (ctx, recipe, angle) => {
    const c = colors(recipe); const flow = angle * turns(recipe);
    for (let band = 0; band < 6; band += 1) {
        curve(ctx, 150, (unit) => ({
            x: 30 + unit * 100,
            y: 45 + band * 14 + Math.sin(unit * TAU * 2 + flow + band * 0.65) * (4 + band * 0.7)
        }), c[band % 3], 0.82 - band * 0.05, band % 2 ? 1 : 2);
    }
    for (let i = 0; i < 9; i += 1) {
        const x = 35 + i * 11; const y = 119 + Math.sin(flow + i) * 3;
        mark(ctx, x, y, 1, c[0], 0.75, 'spark');
    }
};

const drawHelix = (ctx, recipe, angle) => {
    const c = colors(recipe); const flow = angle * turns(recipe);
    for (let side = 0; side < 2; side += 1) {
        curve(ctx, 180, (unit) => ({
            x: 80 + Math.sin(unit * TAU * 2 + flow + side * Math.PI) * 26,
            y: 25 + unit * 110
        }), c[side], side ? 0.45 : 0.95, side ? 1 : 3);
    }
    for (let rung = 0; rung < 13; rung += 1) {
        const unit = rung / 12; const x = Math.sin(unit * TAU * 2 + flow) * 26;
        const y = 25 + unit * 110;
        if (x > 0) line(ctx, 80 - x, y, 80 + x, y, c[2], 0.5, 1);
    }
};

const drawDna = (ctx, recipe, angle) => {
    const c = colors(recipe); const flow = angle * turns(recipe);
    for (let side = 0; side < 2; side += 1) {
        curve(ctx, 170, (unit) => ({
            x: 80 + Math.sin(unit * TAU * 2.5 + flow + side * Math.PI) * 23,
            y: 28 + unit * 104
        }), c[side], 0.9, 2);
    }
    for (let rung = 0; rung < 15; rung += 1) {
        const unit = rung / 14; const shift = Math.sin(unit * TAU * 2.5 + flow) * 23;
        const y = 28 + unit * 104;
        line(ctx, 80 - shift, y, 80 + shift, y, c[rung % 3], 0.7, 2);
        dot(ctx, 80 + shift, y, 3, c[0], 0.9);
    }
};

const drawTunnel = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    for (let depth = 0; depth < 6; depth += 1) {
        const radius = r * (0.23 + depth * 0.15) + Math.sin(angle + depth) * 2;
        polygon(ctx, 4, radius, spin * (depth % 2 ? -1 : 1) * 0.5 + Math.PI / 4, c[depth % 3], 0.65 + depth * 0.04, 2);
    }
    for (let corner = 0; corner < 4; corner += 1) {
        const a = polar(corner * Math.PI / 2 + Math.PI / 4, r * 0.23);
        const b = polar(corner * Math.PI / 2 + Math.PI / 4, r * 0.98);
        line(ctx, a.x, a.y, b.x, b.y, c[2], 0.45, 1);
    }
};

const drawLissajous = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe);
    for (let trace = 0; trace < 2; trace += 1) {
        curve(ctx, 370, (unit) => ({
            x: 80 + Math.sin(unit * TAU * 3 + angle * turns(recipe) + trace * 0.14) * r,
            y: 80 + Math.sin(unit * TAU * 4 + angle * 2 + trace * 0.14) * r * 0.8
        }), c[trace], trace ? 0.52 : 0.9, trace ? 1 : 2);
    }
    mark(ctx, 80, 80, 3, c[0], 0.8, 'diamond');
};

const drawInfinity = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe); const spin = angle * turns(recipe);
    curve(ctx, 300, (unit) => {
        const theta = unit * TAU;
        const denominator = 1 + Math.cos(theta) ** 2;
        return { x: 80 + Math.sin(theta + spin) * r / denominator * 1.45,
            y: 80 + Math.sin(theta * 2 + spin * 2) * r / denominator * 0.8 };
    }, c[1], 0.93, 3);
    const p = { x: 80 + Math.cos(spin) * r * 0.55, y: 80 + Math.sin(spin * 2) * r * 0.3 };
    mark(ctx, p.x, p.y, 3, c[0], 1, 'spark');
};

const drawHourglass = (ctx, recipe, angle) => {
    const c = colors(recipe); const r = motifRadius(recipe);
    const corners = [[-r * 0.65, -r], [r * 0.65, -r], [0, 0], [-r * 0.65, r], [r * 0.65, r]]
        .map(([x, y]) => ({ x: 80 + x, y: 80 + y }));
    const edges = [[0, 1], [0, 2], [1, 2], [2, 3], [2, 4], [3, 4]];
    for (const [a, b] of edges) line(ctx, corners[a].x, corners[a].y, corners[b].x, corners[b].y, c[(a + b) % 3], 0.86, 2);
    for (let grain = 0; grain < 17; grain += 1) {
        const unit = grain / 16; const y = 45 + unit * 70;
        const x = 80 + Math.sin(grain * 4 + angle * 2) * (2 + Math.abs(unit - 0.5) * 17);
        dot(ctx, x, y, 2, c[0], 0.5 + 0.4 * Math.sin(angle + grain));
    }
    mark(ctx, 80, 80, 2, c[0], 1, 'spark');
};

const drawGlitch = (ctx, recipe, angle) => {
    const c = colors(recipe); const random = randomFromSeed(recipe.seed ^ 0x35a6ed07);
    for (let bar = 0; bar < 24; bar += 1) {
        const y = 33 + bar * 4;
        const width = 12 + random() * 45;
        const shift = Math.sin(angle * (bar % 3 + 1) + bar * 3) * (4 + bar % 5);
        const x = 80 + (random() - 0.5) * 48 + shift;
        line(ctx, x - width / 2, y, x + width / 2, y, c[bar % 3], 0.72, bar % 4 === 0 ? 3 : 1, true);
    }
    for (let i = 0; i < 7; i += 1) {
        const x = 46 + i * 11;
        dot(ctx, x + Math.sin(angle + i) * 3, 80 + Math.sin(i * 4) * 28, 4, c[0], 0.85);
    }
};

const drawLattice = (ctx, recipe, angle) => {
    const c = colors(recipe); const sway = Math.sin(angle * turns(recipe)) * 3;
    for (let row = 0; row < 7; row += 1) for (let column = 0; column < 7; column += 1) {
        const x = 38 + column * 14 + Math.sin(row + angle) * sway;
        const y = 38 + row * 14 + Math.cos(column + angle) * sway;
        if (column < 6) line(ctx, x, y, x + 14, y, c[2], 0.45, 1);
        if (row < 6) line(ctx, x, y, x, y + 14, c[2], 0.45, 1);
        mark(ctx, x, y, 1 + ((row + column) % 3 === 0 ? 1 : 0), c[(row + column) % 3], 0.72, 'diamond');
    }
};

const drawChecker = (ctx, recipe, angle) => {
    const c = colors(recipe); const beat = Math.sin(angle * 2);
    for (let row = 0; row < 9; row += 1) for (let column = 0; column < 9; column += 1) {
        const distance = Math.hypot(row - 4, column - 4);
        if (distance > 4.5 || (row + column) % 2) continue;
        const wave = Math.sin(distance * 2 - angle * turns(recipe));
        const size = 3 + (wave + beat > 0.5 ? 2 : 0);
        dot(ctx, 80 + (column - 4) * 11, 80 + (row - 4) * 11, size, c[Math.floor(distance) % 3], 0.5 + 0.4 * Math.abs(wave));
    }
    polygon(ctx, 4, 57, Math.PI / 4, c[1], 0.38, 1);
};

const drawSparks = (ctx, recipe, angle) => {
    const c = colors(recipe); const random = randomFromSeed(recipe.seed ^ 0xc19d4e77);
    for (let spark = 0; spark < 65; spark += 1) {
        const theta = random() * TAU;
        const radius = 8 + random() * 48;
        const speed = spark % 2 ? 1 : -1;
        const wobble = Math.sin(angle * speed + spark) * 5;
        const start = polar(theta + angle * speed, radius + wobble);
        const end = polar(theta + angle * speed, radius + wobble + 3 + random() * 9);
        line(ctx, start.x, start.y, end.x, end.y, c[spark % 3], 0.55 + 0.4 * Math.sin(angle * 2 + spark), spark % 7 === 0 ? 2 : 1);
    }
    mark(ctx, 80, 80, 4, c[0], 1, 'spark');
};

const drawChain = (ctx, recipe, angle) => {
    const c = colors(recipe); const spin = angle * turns(recipe);
    for (let link = 0; link < 9; link += 1) {
        const theta = link * TAU / 9 + spin;
        const center = polar(theta, 36);
        ellipse(ctx, center.x, center.y, 12, 7, theta + Math.PI / 2, c[link % 3], 0.88, 2);
        const pin = polar(theta, 47);
        dot(ctx, pin.x, pin.y, 2, c[0], 0.8);
    }
    ring(ctx, 14, c[2], 0.62, 1);
};

const drawMeteorRain = (ctx, recipe, angle) => {
    const c = colors(recipe); const flow = angle * turns(recipe);
    for (let meteor = 0; meteor < 13; meteor += 1) {
        const column = meteor % 5;
        const row = Math.floor(meteor / 5);
        const x = 46 + column * 18 + Math.sin(flow + meteor * 2) * 9;
        const y = 38 + row * 31 + Math.sin(flow + meteor) * 17;
        line(ctx, x + 11, y - 11, x - 4, y + 4, c[meteor % 3], 0.72, 2);
        line(ctx, x + 16, y - 16, x + 5, y - 5, c[2], 0.42, 1);
        mark(ctx, x - 4, y + 4, 2, c[0], 0.95, 'spark');
    }
};

const EXTRA_RENDERERS = {
    starburst: drawStarburst, sunwheel: drawSunwheel, eclipse: drawEclipse,
    blackhole: drawBlackhole, comet: drawComet, nova: drawNova,
    pentagram: drawPentagram, hexagram: drawHexagram, runicCross: drawRunicCross,
    clockwork: drawClockwork, radar: drawRadar, portal: drawPortal,
    tetrahedron: drawTetrahedron, octahedron: drawOctahedron, crystalBloom: drawCrystalBloom,
    crystalCage: drawCrystalCage, shuriken: drawShuriken, bladeWheel: drawBladeWheel,
    daisy: drawDaisy, rose: drawRose, lotus: drawLotus,
    leafVortex: drawLeafVortex, vine: drawVine, thornRing: drawThornRing,
    fire: drawFire, smoke: drawSmoke, waterfall: drawWaterfall,
    rain: drawRain, aurora: drawAurora, tide: drawTide,
    helix: drawHelix, dna: drawDna, tunnel: drawTunnel,
    lissajous: drawLissajous, infinity: drawInfinity, hourglass: drawHourglass,
    glitch: drawGlitch, lattice: drawLattice, checker: drawChecker,
    sparks: drawSparks, chain: drawChain, meteorRain: drawMeteorRain
};

const drawMotes = (context, model, angle) => {
    const { recipe, motes } = model;
    const c = colors(recipe);
    for (const mote of motes) {
        const motion = angle * mote.speed * turns(recipe) + mote.phase;
        const radius = mote.radius + Math.sin(angle * 2 + mote.phase) * mote.wobble;
        let x = 80 + Math.cos(motion) * radius;
        let y = 80 + Math.sin(motion) * radius;
        if (recipe.motif === 'waves') y = 80 + (y - 80) * 0.65;
        if (recipe.motif === 'prism') {
            x = 80 + (x - 80) * 0.87;
            y = 80 + (y - 80) * 0.87;
        }
        const shimmer = 0.48 + 0.44 * Math.sin(angle * (mote.speed + 1) + mote.phase);
        mark(context, x, y, mote.size, c[mote.color], shimmer * pulse(recipe, angle), mote.shape);
    }
};

export const createLoopArtModel = (recipe) => {
    const random = randomFromSeed(recipe.seed ^ 0x715a47c3);
    const structured = ['sigil', 'prism', 'pentagram', 'hexagram', 'runicCross', 'clockwork',
        'tetrahedron', 'octahedron', 'crystalCage', 'shuriken', 'bladeWheel', 'tunnel',
        'hourglass', 'lattice', 'checker', 'glitch'];
    const count = Math.round(clamp((structured.includes(recipe.motif) ? 24 : 36) * (recipe.density || 1), 20, 75));
    const motes = Array.from({ length: count }, (_, index) => ({
        phase: random() * TAU,
        radius: 19 + random() * 43,
        wobble: 1 + random() * 5,
        speed: index % 3 === 0 ? -1 : 1,
        size: random() > 0.82 ? 2 : 1,
        color: Math.floor(random() * Math.min(4, recipe.palette.length)),
        shape: recipe.particleShapes?.[index % recipe.particleShapes.length] || 'square'
    }));
    return { recipe, motes };
};

export const drawLoopArt = (context, model, time) => {
    const { recipe } = model;
    const phase = ((time / recipe.duration) % 1 + 1) % 1;
    const angle = phase * TAU;
    const motif = LOOP_MOTIFS[recipe.motif] ? recipe.motif : 'mandala';
    if (motif === 'mandala') drawMandala(context, recipe, angle);
    else if (motif === 'sigil') drawSigil(context, recipe, angle);
    else if (motif === 'orbit') drawOrbit(context, recipe, angle);
    else if (motif === 'spiral') drawSpiral(context, recipe, angle);
    else if (motif === 'prism') drawPrism(context, recipe, angle);
    else if (motif === 'lightning') drawLightning(context, recipe, angle);
    else if (motif === 'waves') drawWaves(context, recipe, angle);
    else if (motif === 'plasma') drawPlasma(context, recipe, angle);
    else EXTRA_RENDERERS[motif](context, recipe, angle);
    drawMotes(context, model, angle);
    context.globalAlpha = 1;
};
