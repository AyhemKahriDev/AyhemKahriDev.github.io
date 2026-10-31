const LEVELS = [
  { word: "cat", hint: "A common pet that says meow." },
  { word: "sun", hint: "The bright star that lights Earth during the day." },
  { word: "dog", hint: "A loyal pet known for barking." },
  { word: "map", hint: "A guide used to find places." },
  { word: "pen", hint: "A tool used to write with ink." },
  { word: "cake", hint: "A sweet dessert often served at birthdays." },
  { word: "tree", hint: "A tall plant with a trunk and branches." },
  { word: "book", hint: "Something you open to read pages." },
  { word: "fish", hint: "An animal that swims underwater." },
  { word: "lamp", hint: "A light source for a table or desk." },
  { word: "moon", hint: "Earth's natural satellite seen at night." },
  { word: "star", hint: "A bright point in the night sky." },
  { word: "rain", hint: "Water that falls from clouds." },
  { word: "door", hint: "You open this to enter a room." },
  { word: "milk", hint: "A white drink often poured on cereal." },
  { word: "hand", hint: "The body part with fingers." },
  { word: "park", hint: "A public place with grass, paths, and benches." },
  { word: "bird", hint: "A feathered animal that can often fly." },
  { word: "shoe", hint: "You wear this on your foot." },
  { word: "boat", hint: "A vehicle that travels on water." },
  { word: "ring", hint: "A circular piece of jewelry." },
  { word: "farm", hint: "Land used for crops and animals." },
  { word: "corn", hint: "A yellow crop with rows of kernels." },
  { word: "nest", hint: "A home built by birds." },
  { word: "frog", hint: "A jumping amphibian known for croaking." },
  { word: "apple", hint: "A crisp fruit that can be red or green." },
  { word: "beach", hint: "A sandy shore beside the sea." },
  { word: "bread", hint: "A baked food used in sandwiches." },
  { word: "chair", hint: "Furniture made for sitting." },
  { word: "cloud", hint: "A white shape drifting in the sky." },
  { word: "dance", hint: "Moving to music with rhythm." },
  { word: "flame", hint: "The visible fire on a candle." },
  { word: "grape", hint: "A small fruit used for juice or jam." },
  { word: "house", hint: "A building where people live." },
  { word: "juice", hint: "A drink squeezed from fruit." },
  { word: "kitten", hint: "A young cat." },
  { word: "ladder", hint: "A tool with steps for climbing." },
  { word: "monkey", hint: "An animal that swings through trees." },
  { word: "napkin", hint: "Paper or cloth used during a meal." },
  { word: "orange", hint: "A citrus fruit and also a color." },
  { word: "planet", hint: "A large world orbiting a star." },
  { word: "rabbit", hint: "A long-eared animal that hops." },
  { word: "school", hint: "A place where students learn." },
  { word: "ticket", hint: "A pass used for travel or entry." },
  { word: "travel", hint: "To go from one place to another." },
  { word: "winter", hint: "The coldest season of the year." },
  { word: "yellow", hint: "The bright color of lemons and bananas." },
  { word: "zipper", hint: "A fastener with interlocking teeth." },
  { word: "rocket", hint: "A vehicle launched into space." },
  { word: "market", hint: "A place where goods are bought and sold." },
  { word: "airport", hint: "A place where planes take off and land." },
  { word: "balance", hint: "To stay steady and even." },
  { word: "captain", hint: "The leader of a ship or team." },
  { word: "diamond", hint: "A hard gemstone known for sparkle." },
  { word: "electric", hint: "Powered by flowing energy." },
  { word: "festival", hint: "A large public celebration." },
  { word: "grocery", hint: "Food items bought for the home." },
  { word: "harmony", hint: "A pleasing blend of sounds." },
  { word: "imagine", hint: "To form a picture in your mind." },
  { word: "journey", hint: "A trip from one place to another." },
  { word: "lantern", hint: "A portable light with a handle." },
  { word: "mystery", hint: "Something puzzling or unknown." },
  { word: "notebook", hint: "A book of paper for notes." },
  { word: "painter", hint: "A person who creates art with paint." },
  { word: "question", hint: "A sentence or phrase that asks something." },
  { word: "rainbow", hint: "A colorful arc seen after rain." },
  { word: "sandwich", hint: "Food with filling between slices of bread." },
  { word: "treasure", hint: "A valuable prize or hidden riches." },
  { word: "umbrella", hint: "Something you carry to stay dry in rain." },
  { word: "victory", hint: "Success after a contest or struggle." },
  { word: "wildlife", hint: "Animals living in nature." },
  { word: "yourself", hint: "A word that refers to you personally." },
  { word: "hospital", hint: "A place where patients receive treatment." },
  { word: "keyboard", hint: "A set of keys used to type." },
  { word: "mountain", hint: "A very high natural landform." },
  { word: "adventure", hint: "An exciting experience with risk or discovery." },
  { word: "beautiful", hint: "Very attractive or pleasing." },
  { word: "chocolate", hint: "A sweet treat made from cocoa." },
  { word: "discovery", hint: "Finding something new or important." },
  { word: "education", hint: "The process of learning and teaching." },
  { word: "fireworks", hint: "Colorful explosions in the night sky." },
  { word: "gratitude", hint: "The feeling of being thankful." },
  { word: "hurricane", hint: "A powerful tropical storm." },
  { word: "important", hint: "Having great value or meaning." },
  { word: "jellyfish", hint: "A sea creature with a soft stinging body." },
  { word: "knowledge", hint: "Information gained through learning." },
  { word: "labyrinth", hint: "A complex maze with many turns." },
  { word: "marvelous", hint: "Extremely wonderful or impressive." },
  { word: "narrative", hint: "A story told in words." },
  { word: "overnight", hint: "Happening during the night." },
  { word: "pineapple", hint: "A spiky tropical fruit with sweet yellow flesh." },
  { word: "quarantine", hint: "Isolation used to prevent spread of disease." },
  { word: "resilience", hint: "The ability to recover after difficulty." },
  { word: "telescope", hint: "An instrument for viewing distant objects." },
  { word: "underwater", hint: "Located below the surface of water." },
  { word: "vocabulary", hint: "The set of words a person knows." },
  { word: "whirlwind", hint: "A fast spinning rush of air or activity." },
  { word: "xylophone", hint: "A musical instrument with wooden bars." },
  { word: "zigzagging", hint: "Moving with sharp turns side to side." },
  { word: "juxtapose", hint: "To place things side by side for contrast." }
];

const DIFFICULTY_TIERS = [
  { name: "Easy", start: 0, end: 24, min: 3, max: 4 },
  { name: "Medium", start: 25, end: 49, min: 5, max: 6 },
  { name: "Hard", start: 50, end: 74, min: 7, max: 8 },
  { name: "Complex", start: 75, end: 99, min: 9, max: Infinity }
];

const TOTAL_LEVELS = LEVELS.length;
const MAX_WRONG_GUESSES = 6;
const HINT_UNLOCK_AT = 4;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const levelDisplay = document.getElementById("levelDisplay");
const difficultyDisplay = document.getElementById("difficultyDisplay");
const progressFill = document.getElementById("progressFill");
const statusMessage = document.getElementById("statusMessage");
const wordDisplay = document.getElementById("wordDisplay");
const hintPanel = document.getElementById("hintPanel");
const hintText = document.getElementById("hintText");
const mistakesDisplay = document.getElementById("mistakesDisplay");
const keyboard = document.getElementById("keyboard");
const actionButton = document.getElementById("actionButton");
const stageCard = document.getElementById("stageCard");
const hangmanParts = [...document.querySelectorAll(".hangman-part")];

const state = {
  currentLevel: 0,
  currentWord: "",
  currentHint: "",
  starterLetters: new Set(),
  guessedLetters: new Set(),
  wrongGuesses: 0,
  roundState: "playing"
};

function validateLevels() {
  if (LEVELS.length !== 100) {
    throw new Error(`Levels must contain exactly 100 entries. Found ${LEVELS.length}.`);
  }

  DIFFICULTY_TIERS.forEach((tier) => {
    for (let index = tier.start; index <= tier.end; index += 1) {
      const level = LEVELS[index];

      if (!level || typeof level.word !== "string" || typeof level.hint !== "string") {
        throw new Error(`Level ${index + 1} must contain both a word and a hint.`);
      }

      if (!/^[a-z]+$/i.test(level.word)) {
        throw new Error(`Word "${level.word}" at level ${index + 1} must use letters only.`);
      }

      if (!level.hint.trim()) {
        throw new Error(`Hint missing at level ${index + 1}.`);
      }

      if (level.word.length < tier.min || level.word.length > tier.max) {
        throw new Error(`Word "${level.word}" at level ${index + 1} does not match ${tier.name}.`);
      }
    }
  });
}

function getTierForLevel(levelIndex) {
  return DIFFICULTY_TIERS.find((tier) => levelIndex >= tier.start && levelIndex <= tier.end);
}

function buildStarterLetters(word, levelIndex) {
  const tier = getTierForLevel(levelIndex);
  const starterLetters = new Set();

  if (tier.name === "Easy" || tier.name === "Medium") {
    const clueIndex = levelIndex % 2 === 0 ? 0 : word.length - 1;
    starterLetters.add(word[clueIndex]);
  } else {
    starterLetters.add(word[0]);
    starterLetters.add(word[word.length - 1]);

    if (starterLetters.size === 1) {
      starterLetters.add(word[Math.floor(word.length / 2)]);
    }
  }

  return starterLetters;
}

function getStarterLetterCount() {
  return state.starterLetters.size;
}

function isLetterVisible(letter) {
  return state.starterLetters.has(letter) || state.guessedLetters.has(letter);
}

function getSolved() {
  return state.currentWord.split("").every((letter) => isLetterVisible(letter));
}

function updateStatus(message) {
  statusMessage.textContent = message;
}

function showActionButton(label, onClick) {
  actionButton.textContent = label;
  actionButton.onclick = onClick;
  actionButton.classList.remove("hidden");
}

function hideActionButton() {
  actionButton.textContent = "";
  actionButton.onclick = null;
  actionButton.classList.add("hidden");
}

function startLevel() {
  const level = LEVELS[state.currentLevel];

  state.currentWord = level.word.toUpperCase();
  state.currentHint = level.hint;
  state.starterLetters = buildStarterLetters(state.currentWord, state.currentLevel);
  state.guessedLetters = new Set();
  state.wrongGuesses = 0;
  state.roundState = "playing";

  const clueCount = getStarterLetterCount();
  const clueLabel = clueCount === 1 ? "letter is" : "letters are";
  updateStatus(`${clueCount} clue ${clueLabel} already visible. Guess the rest of the word.`);
  hideActionButton();
  render();
}

function nextLevel() {
  if (state.currentLevel < TOTAL_LEVELS - 1) {
    state.currentLevel += 1;
  }

  startLevel();
}

function retryLevel() {
  startLevel();
}

function restartGame() {
  state.currentLevel = 0;
  startLevel();
}

function handleGuess(letter) {
  if (
    state.roundState !== "playing" ||
    state.starterLetters.has(letter) ||
    state.guessedLetters.has(letter)
  ) {
    return;
  }

  state.guessedLetters.add(letter);

  if (!state.currentWord.includes(letter)) {
    state.wrongGuesses += 1;
  }

  if (getSolved()) {
    if (state.currentLevel === TOTAL_LEVELS - 1) {
      state.roundState = "complete";
      updateStatus("Game Completed! You cleared all 100 levels.");
      showActionButton("Play Again", restartGame);
    } else {
      state.roundState = "won";
      updateStatus("Level Cleared! Move on when you're ready.");
      showActionButton("Next Level", nextLevel);
    }
  } else if (state.wrongGuesses >= MAX_WRONG_GUESSES) {
    state.roundState = "lost";
    updateStatus(`Game Over. The word was ${state.currentWord}.`);
    showActionButton("Retry Level", retryLevel);
  } else if (state.wrongGuesses === HINT_UNLOCK_AT) {
    updateStatus("Hint unlocked. Use it to finish the level before the last two mistakes.");
  }

  render();
}

function renderHeader() {
  const levelNumber = state.currentLevel + 1;
  const tier = getTierForLevel(state.currentLevel);

  levelDisplay.textContent = `${levelNumber} / ${TOTAL_LEVELS}`;
  difficultyDisplay.textContent = tier.name;
  difficultyDisplay.dataset.tier = tier.name.toLowerCase();
  progressFill.style.width = `${(levelNumber / TOTAL_LEVELS) * 100}%`;
  mistakesDisplay.textContent = state.wrongGuesses;
}

function renderWord() {
  const revealAll =
    state.roundState === "lost" ||
    state.roundState === "won" ||
    state.roundState === "complete";

  wordDisplay.innerHTML = "";

  state.currentWord.split("").forEach((letter) => {
    const slot = document.createElement("span");
    const visible = revealAll || isLetterVisible(letter);

    slot.className = `letter-slot${visible ? "" : " empty"}`;
    slot.textContent = visible ? letter : "_";
    wordDisplay.appendChild(slot);
  });
}

function renderHint() {
  const shouldShowHint = state.wrongGuesses >= HINT_UNLOCK_AT || state.roundState === "lost";

  if (shouldShowHint) {
    hintPanel.classList.remove("hidden");
    hintText.textContent = state.currentHint;
  } else {
    hintPanel.classList.add("hidden");
    hintText.textContent = "";
  }
}

function renderHangman() {
  stageCard.classList.toggle("is-lost", state.roundState === "lost");

  hangmanParts.forEach((part) => {
    const step = Number(part.dataset.step);
    part.classList.toggle("visible", state.wrongGuesses >= step);
  });
}

function renderKeyboard() {
  keyboard.innerHTML = "";

  const keyboardLocked = state.roundState !== "playing";

  ALPHABET.forEach((letter) => {
    const button = document.createElement("button");
    const isStarter = state.starterLetters.has(letter);
    const wasGuessed = state.guessedLetters.has(letter);

    button.type = "button";
    button.className = "key";
    button.textContent = letter;
    button.disabled = keyboardLocked || isStarter || wasGuessed;

    if (isStarter) {
      button.classList.add("prefilled");
    } else if (wasGuessed) {
      button.classList.add(state.currentWord.includes(letter) ? "correct" : "wrong");
    }

    button.addEventListener("click", () => handleGuess(letter));
    keyboard.appendChild(button);
  });
}

function render() {
  renderHeader();
  renderWord();
  renderHint();
  renderHangman();
  renderKeyboard();
}

window.addEventListener("keydown", (event) => {
  if (/^[a-z]$/i.test(event.key)) {
    handleGuess(event.key.toUpperCase());
  }

  if (event.key === "Enter" && !actionButton.classList.contains("hidden")) {
    actionButton.click();
  }
});

validateLevels();
startLevel();
