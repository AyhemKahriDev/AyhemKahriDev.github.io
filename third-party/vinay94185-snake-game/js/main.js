function ingame() {
	++frames;
	draw();
	
	// show snakes
	for(sno = 0; sno < smax;++sno) {
		if(snakes[sno].isPlayer) { 
		if(controlmode === 3 || controlmode === 1) {
			playerX = snakes[sno].x;
			playerY = snakes[sno].y;
			snakes[sno].moveI(mvx,mvy);
		} else {
			snakes[sno].move(playerGo);
		}
			snakes[sno].name(name);
			cam.follow(snakes[sno].x,snakes[sno].y);
			score = snakes[sno].score;
		} else { 
			snakes[sno].smartMove();
		}
		
		// dettect collision
		if(snakes[sno].colliide(snakes)) {
		if(snakes[sno].isPlayer) {
			snakes[sno].die();
			gameon = false;
			smax--;
		} else {
			snakes[sno].die();
			newSnake(false);
		}
			snakes.splice(sno,1);
			--sno;
		}
	}
	
	// eat food
	for(var i=0,n = edible.length;i<n;++i) {
			for(sno = 0; sno < smax;++sno) {				
			const dis = GetDistance(snakes[sno].x,snakes[sno].y,edible[i].x,edible[i].y);
			if(dis <= 20) {
					snakes[sno].eat(edible[i].mass);
					edible.splice(i,1);
					n = edible.length;
					break;
				}
			if(dis <= 100) {
					snakes[sno].eatlist(edible[i].x,edible[i].y);
				}
			}
	}	
	
	displayScore();
	if(!gameon) gameover();
	frame = requestAnimationFrame(ingame);		
}