if (sessionStorage.getItem("started") !== "yes") {
  window.location.href = "start.html";
}

document.getElementById("back-btn").addEventListener("click", () => {
  setTimeout(() => {
    window.location.href = "start.html";
  }, 450);
})

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 25, 50, 75, 100].sort(
  (a, b) => 0.5 - Math.random()
);

const numberSpans = document.querySelectorAll(".number span");
const box = document.querySelector(".flipbox-front");
sessionStorage.setItem("generationCounter", 0);

box.addEventListener("click", generationEventHandler);

function generationEventHandler() {
  if (sessionStorage.getItem("generationCounter") < 6) {
    sessionStorage.setItem(
      "generationCounter",
      Number(sessionStorage.getItem("generationCounter")) + 1
    );

    const number = numbers[Math.floor(Math.random() * numbers.length)];
    document.getElementById("generated-number").textContent = number;
    let inserted = false;
    for (let i = 0; !inserted; i++) {
      if (numberSpans[i].textContent === "") {
        numberSpans[i].classList.add("rotate");
        numberSpans[i].textContent = number;
        inserted = true;
      }
    }
    document.querySelector(".flipbox-inner").classList.add("flip");
    setTimeout(() => {
      document.querySelector(".flipbox-inner").classList.remove("flip");
    }, 800);
  }
  setTimeout(() => {
    if (sessionStorage.getItem("generationCounter") > 5) {
      box.removeEventListener("click", generationEventHandler);
      box.style.cursor = "default";
      box.textContent = "Todos los números generados";
      setInterval(timer, 1000);
      setTimeout(() => {
        storeAvailableNumbers();
        const targetNumber = generateTargetNumber();
        sessionStorage.setItem("targetNumber", Number(targetNumber));
        openNumberModal(targetNumber);
        playAlertSound();
        setTimeout(() => {
          setSoundtrackTime();
          window.location.href = "../game/play.html";
        }, 5500);
      }, 4000);
    }
  }, 200);
}

let secondsLeft = 3;
function timer() {
  if (window.getComputedStyle(box).fontSize !== "5em") {
    box.style.fontSize = "5em";
  }
  if (secondsLeft > 0) {
    secondsLeft--;
    box.textContent = secondsLeft;
  }
}

function openNumberModal(targetNumber) {
  document.querySelector("#target-number span").textContent = targetNumber;
  document.getElementById("overlay").classList.add("is-visible");
  document.getElementById("number-modal").classList.add("is-visible");
  moveProgressBar();
}

function generateTargetNumber() {
  return Math.floor(Math.random() * (999 - 101 + 1) + 101);
}

function storeAvailableNumbers() {
  const availableNumbers = [];
  numberSpans.forEach((number) => {
    availableNumbers.push(Number(number.textContent));
  });

  sessionStorage.setItem("availableNumbers", JSON.stringify(availableNumbers));
}

function moveProgressBar() {
  const progressBar = document.querySelector(".bar");
  const seconds = document.getElementById("seconds-left");
  let secondsLeft = 5;
  progressBar.style.animationPlayState = "running";
  setInterval(() => {
    if (secondsLeft > 0) {
      secondsLeft--;
      seconds.textContent = secondsLeft;
    }
  }, 1000);
}

// Sonido dado
const diceSound = new Audio("../game/assets/audio/dice.mp3");
diceSound.volume = 0.8;
document.querySelector(".flipbox-front").addEventListener("click", () => {
  diceSound.play();
})
