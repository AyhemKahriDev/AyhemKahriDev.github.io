/**
 * Themed word pools for the daily word-search. Words are 3-10 letters, uppercase,
 * and checked to be unique inside their theme.
 *
 * Licensed/original content for this project. Themes double as the daily
 * rotation and as SEO landing pages ("haunt word search", "candy word search").
 */

export const themes = [
  {
    id: 'haunt',
    title: 'Ghost Haunt',
    accent: '#FF4FA8',
    words: [
      'PHANTOM', 'SPIRIT', 'SHADOW', 'HAUNT', 'WRAITH', 'CURSE', 'SPECTER', 'BANSHEE',
      'VAMPIRE', 'ZOMBIE', 'PUMPKIN', 'FRIGHT', 'GHOST', 'CREEP', 'ECHO', 'MIST',
      'CANDLE', 'CRYPT', 'CLAW', 'GOBLIN', 'WITCH', 'BROOM', 'SPIDER', 'COFFIN',
      'SCREAM', 'HOWL', 'CEMETERY', 'RAVEN', 'CANDLELIGHT', 'FOG', 'MUMMY', 'SKULL',
    ],
  },
  {
    id: 'neon',
    title: 'Neon City',
    accent: '#2FE6FF',
    words: [
      'SKYLINE', 'ROBOT', 'RETRO', 'CIRCUIT', 'GLITCH', 'HOLOGRAM', 'DROID', 'NEXUS',
      'PULSE', 'SYNTH', 'CHROME', 'LASER', 'ARCADE', 'NEON', 'VECTOR', 'PIXEL',
      'TURBO', 'WIRE', 'BLASTER', 'COMBO', 'TOKEN', 'COIN', 'BOOST', 'GRAVITY',
      'DOWNTOWN', 'MALL', 'CABLE', 'MATRIX', 'STATIC', 'RIOT', 'DUSK', 'MOTEL',
    ],
  },
  {
    id: 'space',
    title: 'Deep Space',
    accent: '#9FD8FF',
    words: [
      'NEBULA', 'GALAXY', 'ORBIT', 'COMET', 'METEOR', 'PULSAR', 'QUASAR', 'ROCKET',
      'COSMOS', 'ECLIPSE', 'STARDUST', 'SATURN', 'PLANET', 'LUNAR', 'ASTRAL', 'COMET',
      'GRAVITY', 'LAUNCH', 'PAYLOAD', 'CRATER', 'ATMOS', 'IONOSPHERE', 'VOID', 'NEUTRON',
      'MARS', 'VENUS', 'PLUTO', 'APOGEE', 'PERIGEE', 'STARFIELD', 'ION', 'HELIX',
    ],
  },
  {
    id: 'magic',
    title: 'Ancient Magic',
    accent: '#FFC93E',
    words: [
      'WIZARD', 'TALISMAN', 'ENCHANT', 'MYSTIC', 'ORACLE', 'PHOENIX', 'CAULDRON',
      'GRAIL', 'SCROLL', 'POTION', 'ARCANE', 'SIGIL', 'SPELL', 'RUNE', 'CRYSTAL',
      'DRAGON', 'GRIMOIRE', 'ASTRAL', 'ALCHEMY', 'CANDLE', 'SUMMON', 'CHARM', 'CHARMED',
      'MANA', 'CURSED', 'AMULET', 'SHRINE', 'HEX', 'GOBLIN', 'ELIXIR', 'SANCTUM',
    ],
  },
  {
    id: 'nature',
    title: 'Wild Nature',
    accent: '#3DFFA9',
    words: [
      'JUNGLE', 'FOREST', 'MEADOW', 'CANYON', 'GLACIER', 'VOLCANO', 'OASIS', 'RAVINE',
      'SUMMIT', 'TUNDRA', 'LAGOON', 'BAMBOO', 'CEDAR', 'RIVER', 'THICKET', 'PRAIRIE',
      'FALLS', 'ISLAND', 'DELTA', 'MOSS', 'FERN', 'WILLOW', 'ORCHARD', 'CLOVER',
      'MARSH', 'BLUFF', 'RAVEN', 'HERON', 'BADGER', 'MOOSE', 'SALMON', 'ECHO',
    ],
  },
  {
    id: 'candy',
    title: 'Candy Rush',
    accent: '#FF8FB3',
    words: [
      'CARAMEL', 'TRUFFLE', 'GUMMY', 'WAFFLE', 'LOLLIPOP', 'MACARON', 'PUDDING',
      'SHERBET', 'TAFFY', 'NUTMEG', 'CINNAMON', 'SYRUP', 'TOFFEE', 'PRALINE', 'FUDGE',
      'BONBON', 'NOUGAT', 'COCOA', 'VANILLA', 'MINT', 'SPRINKLE', 'GUMDROP', 'BARLEY',
      'HONEY', 'CANDY', 'SUGAR', 'LICORICE', 'PRETZEL', 'WAFFLES', 'JELLY', 'CUSTARD',
    ],
  },
  {
    id: 'ocean',
    title: 'Deep Ocean',
    accent: '#5AC8FA',
    words: [
      'CORAL', 'TIDE', 'KELP', 'ANEMONE', 'TRENCH', 'PLANKTON', 'SEAFLOOR', 'CURRENT',
      'LOBSTER', 'HERRING', 'MARLIN', 'ANCHOVY', 'DOLPHIN', 'ORCA', 'WHALE', 'SQUID',
      'JELLYFISH', 'STARFISH', 'SEAHORSE', 'URCHIN', 'MOLLUSK', 'ABYSS', 'SALINE', 'LAGOON',
      'MAST', 'HARBOR', 'ANCHOR', 'SAILFIN', 'BARNACLE', 'ISOPOD', 'REEF', 'TIDEPOOL',
    ],
  },
  {
    id: 'retro',
    title: 'Retro Arcade',
    accent: '#B388FF',
    words: [
      'JOYSTICK', 'COINOP', 'HIGHSCORE', 'SPRITE', 'TILE', 'SIDECAR', 'CRT', 'JOYPAD',
      'BUTTON', 'BEEP', 'CHIPTUNE', 'CARTRIDGE', 'ATARI', 'ARCADE', 'MIDWAY', 'GALAGA',
      'TETRIS', 'PONG', 'QIX', 'FROGGER', 'DONKEY', 'BURNOUT', 'CREDITS', 'INSERT',
      'COIN', 'VERSUS', 'HIGHSCORES', 'PIXEL', 'VECTOR', 'FLOPPY', 'BOOMERANG', 'PINBALL',
    ],
  },
  {
    id: 'kitchen',
    title: 'The Kitchen',
    accent: '#FFB870',
    words: [
      'SPATULA', 'WHISK', 'SIMMER', 'SAUTE', 'BLANCH', 'PREHEAT', 'MARINADE', 'RENDER',
      'PEEL', 'ZEST', 'CRUMB', 'PROOF', 'BATTER', 'DOUGH', 'PROOFING', 'OVEN',
      'SAUCEPAN', 'COLANDER', 'TONG', 'GRATER', 'MORTAR', 'SKIMMER', 'BROTH', 'STEW',
      'KNEAD', 'PROOF', 'FLOUR', 'SUGAR', 'BUTTER', 'GARNISH', 'SKIMMER', 'PARCH',
    ],
  },
  {
    id: 'sport',
    title: 'Game Day',
    accent: '#FF6B6B',
    words: [
      'STADIUM', 'OVERTIME', 'FOUL', 'STRIKE', 'HOME', 'AWAY', 'INNING', 'TURF',
      'RUNNER', 'SCOREBOARD', 'HALFTIME', 'TIMEOUT', 'PENALTY', 'DRIBBLE', 'REBOUND',
      'FACEOFF', 'BULLSEYE', 'PITCHER', 'BATTER', 'GOALPOST', 'WHISTLE', 'BENCH', 'REFEREE',
      'FINALS', 'TROPHY', 'JERSEY', 'SHOES', 'CLEATS', 'COURT', 'LANES', 'TEAM',
    ],
  },
];

export const themeById = Object.fromEntries(themes.map((t) => [t.id, t]));

/** Themes rotate deterministically by day. */
export function themeForDate(date, seed) {
  return themes[Math.abs(Math.trunc(seed)) % themes.length];
}
