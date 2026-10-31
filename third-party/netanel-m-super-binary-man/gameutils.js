function generateRandomSequence() {
  // generate a new binary sequence
  let newSequence = "";
  for(let i = 0; i < sequence.length; i++) {
    randomNumber = Math.random();
    if(randomNumber < 0.5) {
      newSequence += "0";
    } else {
      newSequence += "1";
    }
  }
  // make sure the chosen sequence doesn't sum to zero
  if(parseInt(newSequence, 2) > 0) {
    sequence = newSequence;
  } else {
    generateRandomSequence();
  }

}

function resetLevel(lifeDown) {
  for(let i = 0; i < enemies.length; i++) {
    enemies[i].resetPosition();
    enemies[i].onTheGround = false;
  }
  player.resetPosition();
  player.onTheGround = false;
  if(lifeDown === true) {
    player.life -= 1;
  }

  accum = 0;
  resetBlocks();

  if(player.life <= 0) {
    gameOver();
  }
}

function resetBlocks() {
  // reset blocks to default state
  generateRandomSequence();
  for(let i = 0; i < blocks.length; i++) {
    blocks[i].status = "inactive";
    blocks[i].gradient = blockGradient;
  }
  solution = parseInt(sequence, 2);
}
