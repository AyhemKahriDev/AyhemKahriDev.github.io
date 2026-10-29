function initEvents() {
  canvas.addEventListener('mousemove', mouseMoved);
  canvas.addEventListener('mousedown', mouseDown);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
}

function keyDown(event) {
  allKeys.push(event.code);

  if(allKeys.includes("KeyS") && allKeys.includes("Space")) {
    player.jumpDown = true;
  }

  else if(event.code === "KeyD" || event.code === "ArrowRight") {
    player.goRight = true;
  }
  else if (event.code === "KeyA" || event.code === "ArrowLeft") {
    player.goLeft = true;
  }
  else if (event.code === "Space") {
    player.jump = true;
  }
}

function keyUp(event) {
  if(allKeys.includes(event.code)) {
    allKeys.splice(allKeys.indexOf(event.code));
  }
  if(event.code === "KeyD" || event.code === "ArrowRight") {
    player.goRight = false;
  }
  else if (event.code === "KeyA" || event.code === "ArrowLeft") {
    player.goLeft = false;
  }
  else if (event.code === "Space") {
    player.jump = false;
  }
  else if (event.code === "KeyS") {
    player.jump = false;
  }
}

function mouseMoved(event) {
  mousePos = getMousePos(event);
}
function mouseDown(event) {
  mousePos = getMousePos(event);
  console.log('boom ' + mousePos.x, mousePos.y);
}
function getMousePos(event) {
    var rect = canvas.getBoundingClientRect();
    return new Vector(
      event.clientX - rect.left,
      event.clientY - rect.top
    );
}
