const board = document.getElementById("game-board");
const emojis = ["🍎","🍌","🍇","🍒","🍓","🍉","🍋","🍊"];
let cards = [...emojis, ...emojis];
let flipped = [];
let matched = [];

shuffle(cards);
drawBoard();

function shuffle(arr) {
  arr.sort(() => Math.random() - 0.5);
}

function drawBoard() {
  board.innerHTML = "";
  cards.forEach((emoji, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.index = i;
    card.textContent = emoji;
    card.addEventListener("click", () => flipCard(card, emoji));
    board.appendChild(card);
  });
}

function flipCard(card, emoji) {
  if (flipped.length === 2 || matched.includes(card)) return;
  card.classList.add("flipped");
  flipped.push({card, emoji});

  if (flipped.length === 2) {
    if (flipped[0].emoji === flipped[1].emoji) {
      matched.push(flipped[0].card, flipped[1].card);
      flipped = [];
      if (matched.length === cards.length) setTimeout(() => alert("You Win! 🎉"), 300);
    } else {
      setTimeout(() => {
        flipped.forEach(f => f.card.classList.remove("flipped"));
        flipped = [];
      }, 700);
    }
  }
}
