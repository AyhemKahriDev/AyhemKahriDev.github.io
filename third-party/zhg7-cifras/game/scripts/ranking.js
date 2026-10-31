document.getElementById("back-btn").addEventListener("click", () => {
  setTimeout(() => {
    window.location.href = "../index.html";
  }, 450);
})

const players = JSON.parse(localStorage.getItem("ranking"));

if (players !== null && players.length > 0) {
  const table = document.getElementById("ranking-table");
  document.getElementById("no-data").remove(); // Eliminar placeholder para cuando no existe datos.
  players.forEach((player) => {
    const playerName = player["player"];
    const playerScore = player["score"];
    const row = table.insertRow(table.rows.length);
    const nameCell = row.insertCell(0);
    const scoreCell = row.insertCell(1);
    nameCell.textContent = playerName;
    scoreCell.textContent = playerScore;
  });
}

