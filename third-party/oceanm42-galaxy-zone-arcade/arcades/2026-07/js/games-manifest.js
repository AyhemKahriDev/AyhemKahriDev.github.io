/*!
 * js/games-manifest.js
 * Sal's Galaxy Zone Arcade — game catalog.
 *
 * Pure data, no logic. Every game page and the homepage read this array to
 * know a game's title, accent color, touch layout, and blurb. Keep this file
 * loaded FIRST (before engine/gz-core.js) on every page that needs it.
 *
 * Attaches ONE global: window.GZ_MANIFEST
 */
(function () {
  'use strict';

  window.GZ_MANIFEST = [
    { slug: 'pac-chase', title: 'Pac-Chase', inspiredBy: 'Pac-Man', year: 1980, accent: '#ffe600', touchLayout: 'dpad-a', blurb: 'Gobble the dots. Outsmart four ghosts with four personalities.' },
    { slug: 'space-defenders', title: 'Space Defenders', inspiredBy: 'Space Invaders', year: 1978, accent: '#39ff6a', touchLayout: 'lr-a', blurb: 'The march comes down. Hold the line behind your bunkers.' },
    { slug: 'asteroid-blaster', title: 'Asteroid Blaster', inspiredBy: 'Asteroids', year: 1979, accent: '#eaf6ff', touchLayout: 'lr-ud-ab', blurb: "Thrust, drift, blast. The rocks split until they don't." },
    { slug: 'barrel-jump', title: 'Barrel Jump', inspiredBy: 'Donkey Kong', year: 1981, accent: '#ff8a00', touchLayout: 'dpad-a', blurb: 'Climb the girders. Time the jumps. Save the day.' },
    { slug: 'road-hopper', title: 'Road Hopper', inspiredBy: 'Frogger', year: 1981, accent: '#39ff6a', touchLayout: 'dpad-a', blurb: 'Five lanes of traffic, one hungry river. Hop for your life.' },
    { slug: 'galaxy-raiders', title: 'Galaxy Raiders', inspiredBy: 'Galaga', year: 1981, accent: '#00f0ff', touchLayout: 'lr-a', blurb: 'They dive in formation. Win your ship back and fight double.' },
    { slug: 'brick-breaker', title: 'Brick Breaker', inspiredBy: 'Breakout', year: 1976, accent: '#ff2ec4', touchLayout: 'lr-a', blurb: "Every brick has a price. Don't let the ball past you." },
    { slug: 'retro-tennis', title: 'Retro Tennis', inspiredBy: 'Pong', year: 1972, accent: '#eaf6ff', touchLayout: 'lr-ud-a', blurb: 'The one that started it all. First to 11 takes the match.' },
    { slug: 'bug-shooter', title: 'Bug Shooter', inspiredBy: 'Centipede', year: 1980, accent: '#39ff6a', touchLayout: 'lr-ud-a', blurb: 'It splits when you shoot it. The mushrooms remember.' },
    { slug: 'city-defense', title: 'City Defense', inspiredBy: 'Missile Command', year: 1980, accent: '#ff3355', touchLayout: 'aim-tap', blurb: 'Six cities. Three batteries. The sky is falling.' },
    { slug: 'tunnel-hero', title: 'Tunnel Hero', inspiredBy: 'Dig Dug', year: 1982, accent: '#ff8a00', touchLayout: 'dpad-a', blurb: 'Dig your own maze. Pump them up until they pop.' },
    { slug: 'cube-hopper', title: 'Cube Hopper', inspiredBy: 'Q*bert', year: 1982, accent: '#a94dff', touchLayout: 'dpad-a', blurb: 'Hop the pyramid. Change every cube. Mind the snake.' },
    { slug: 'knight-flyer', title: 'Knight Flyer', inspiredBy: 'Joust', year: 1982, accent: '#ffe600', touchLayout: 'lr-a', blurb: 'Flap to fly. Land on their heads, not under them.' },
    { slug: 'star-guardian', title: 'Star Guardian', inspiredBy: 'Defender', year: 1981, accent: '#00f0ff', touchLayout: 'lr-ud-ab', blurb: 'Scroll both ways. The colonists are counting on you.' },
    { slug: 'neon-cycles', title: 'Neon Cycles', inspiredBy: 'Tron', year: 1982, accent: '#00f0ff', touchLayout: 'swipe', blurb: 'Leave a wall of light. Make them hit it first.' },
    { slug: 'vortex', title: 'Vortex', inspiredBy: 'Tempest', year: 1981, accent: '#a94dff', touchLayout: 'lr-ab', blurb: "Ride the rim of the well. Nothing crawls out on your watch.", isNew: true }
  ];
})();
