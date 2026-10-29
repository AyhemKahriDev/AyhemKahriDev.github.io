function collideSpriteWithPlatforms(sprite, secondSprite) {
  //let deltaPos = sprite.previousPos.returnSub(sprite.pos);
  //deltaPos.normalize();
  // These ifs are for actual collisions
  if ( sprite.intersectsWith(secondSprite) ) {
    //sprite.pos = new Vector(sprite.pos.x+deltaPos.x, sprite.pos.y+deltaPos.y); //No longer necessary for now
    //  this if are for checking whether something is underneath the player
    if ( sprite.bottom <= secondSprite.top ){ // something is underneath
      sprite.onTheGround = true;
      sprite.pos.y = secondSprite.top-sprite.h;
      sprite.velocity.mult(0);
      return true
    }
  } else {
    return false;
  }

}

function collideSpriteWithWalls(sprite, secondSprite) {
  //let deltaPos = sprite.previousPos.returnSub(sprite.pos);
  //deltaPos.normalize();
  // These ifs are for actual collisions
  if ( sprite.intersectsWith(secondSprite) ) {
    //  this if are for checking whether something is underneath the player
    if ( sprite.bottom <= secondSprite.top ){ // something is underneath
      sprite.onTheGround = true;
      sprite.pos.y = secondSprite.top-sprite.h;
      sprite.velocity.mult(0);
      return true
    }

    if ( sprite.right <= secondSprite.left ) { // something is to the right
      sprite.pos.x = secondSprite.left-sprite.w;
      if ( sprite.goRight === true ) {
        sprite.goRight = false;
      }
      return true
    }

    if ( sprite.left >= secondSprite.right ) { // something is to the left
      sprite.pos.x = secondSprite.right;
      if( sprite.goLeft === true ) {
        sprite.goLeft = false;
      }
      return true
    }

    if ( sprite.top <= secondSprite.bottom  ){ // something is above
      sprite.pos.y = secondSprite.bottom;
      sprite.velocity.mult(0);
      return true
    }

  } else {
    return false;
  }

}

function collideSpriteWithBlocks(sprite, secondSprite) {
  if( sprite.intersectsWith(secondSprite) ) {
    if ( sprite.bottom <= secondSprite.top ){ // something is underneath
      sprite.onTheGround = true;
      sprite.pos.y = secondSprite.top-sprite.h;
      sprite.velocity.mult(0);
      return true
    }

    if ( sprite.right <= secondSprite.left ) { // something is to the right
      sprite.pos.x = secondSprite.left-sprite.w;
      return true
    }

    if ( sprite.left >= secondSprite.right ) { // something is to the left
      sprite.pos.x = secondSprite.right;
      return true
    }

    if ( sprite.top <= secondSprite.bottom  ){ // something is above
      sprite.pos.y = secondSprite.originalY+sprite.h;
      secondSprite.toggle();
      sprite.velocity.mult(0);
      return true
    }

  } else {
    return false;
  }

}

function collideSpriteWithSprite(sprite, secondSprite) {
  if( sprite.intersectsWith(secondSprite) ) {
      return true
    } else {
      return false;
    }
}
