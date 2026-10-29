document.getElementById("back-btn").addEventListener("click", () => {
  setTimeout(() => {
    window.location.href = "../index.html";
  }, 450);
})

document.getElementById("overlay").addEventListener("click", () => {
  document.getElementById("overlay").classList.remove("is-visible");
  document.getElementById("play-modal").classList.remove("is-visible");
});

document.getElementById("play-close-btn").addEventListener("click", () => {
  document.getElementById("overlay").classList.remove("is-visible");
  document.getElementById("play-modal").classList.remove("is-visible");
});

document.getElementById("play-btn").addEventListener("click", playEventHandler);

if (sessionStorage.getItem("playAgain") !== null) {
  fillFields();
  sessionStorage.removeItem("playAgain");
}

function playEventHandler() {
  const nameFields = document.querySelectorAll(".player_name");
  const emptyFields = [];
  nameFields.forEach((field) => {
    if (field.value.trim() === "" || nameFields[0].value.trim() === nameFields[1].value.trim()) {  // No permitir nombres iguales.
      emptyFields.push(field);
    } else {
      revertFieldStyles(field);
    }
  });

  if (emptyFields.length === 0) { 
    playAlertSound();
    document.getElementById("overlay").classList.add("is-visible");
    document.getElementById("play-modal").classList.add("is-visible");
  } else {
    highlightEmptyFields(emptyFields);
    playErrorSound();
  }
}

document.querySelectorAll(".player_color").forEach((picker) => {
  picker.addEventListener("input", (e) => {
    const playerIcon = document.getElementById(
      `player${e.target.id.substr(6, 1)}_icon`
    );
    const playerColor = document.getElementById(
      `player${e.target.id.substr(6, 1)}_color`
    ).value;
    playerIcon.style.fill = playerColor;
  });
});

document.getElementById("confirm-play-btn").addEventListener("click", () => {
  setSoundtrackTime();
  storePlayers();
  setTimeout(() => {
    window.location.href = "../game/randomizer.html";
  }, 450);
});



function storePlayers() {
  const player1 = {
    name: document.getElementById("player1_name").value.trim(),
    color: document.getElementById("player1_color").value,
  };

  const player2 = {
    name: document.getElementById("player2_name").value.trim(),
    color: document.getElementById("player2_color").value,
  };

  const players = [player1, player2];
  sessionStorage.setItem("currentPlayers", JSON.stringify(players));
  sessionStorage.setItem("started", "yes");
}

document.querySelectorAll(".player-icon").forEach((player) => {
  player.addEventListener("click", (e) => {
    if (e.target.tagName !== "svg") {
      const colorPicker = document.getElementById(
        `player${e.target.parentElement.id.substr(6, 1)}_color`
      );
      colorPicker.click();
    }
  });
});

function highlightEmptyFields(fields) {
  fields.forEach((field) => {
    field.style.backgroundColor = "rgba(239,83,80,0.70)";
    field.classList.add("error-shake");
    field.nextElementSibling.classList.add("error-shake");
    navigator.vibrate(50);
    setTimeout(() => {
      field.classList.remove("error-shake");
      field.nextElementSibling.classList.remove("error-shake");
    }, 500);
  });
}

function revertFieldStyles(field) {
  field.style.backgroundColor = "";
}

function fillFields() {
  const players = JSON.parse(sessionStorage.getItem("currentPlayers"));
  const playerNames = document.querySelectorAll(".player_name");
  const playerColors = document.querySelectorAll(".player_color");
  const playerIcons = document.querySelectorAll(".player-icon");
  for (let i = 0; i <= 1; i++) {
    playerNames[i].value = players[i]["name"];
    playerColors[i].value = players[i]["color"];
    playerIcons[i].style.fill = players[i]["color"];
  }
}
