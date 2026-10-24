/**
 * Check if two objects are colliding
 * @param object1 first object
 * @param object2 second object
 * @param overlap allowed overlap size
 * @returns {Boolean} true if collision detected
 */
function CheckIntersect(object1, object2, overlap)
{
	//    x-axis                     x-axis
	//  A1------>B1 C1              A2------>B2 C2
	//  +--------+   ^              +--------+   ^
	//  | object1|   | y-axis       | object2|   | y-axis
	//  |        |   |              |        |   |
	//  +--------+  D1              +--------+  D2
	//
	// overlap is the allowed overlap zone size
	A1 = object1.x + overlap;
	B1 = object1.x + object1.size - overlap;
	C1 = object1.y + overlap;
	D1 = object1.y + object1.size - overlap;
 
	A2 = object2.x + overlap;
	B2 = object2.x + object2.size - overlap;
	C2 = object2.y + overlap;
	D2 = object2.y + object2.size - overlap;
 
	// check if they overlap on the x-axis
	if(A1 >= A2 && A1 <= B2
	   || B1 >= A2 && B1 <= B2)
	{
		// check if they overlap on the y-axis
		if(C1 >= C2 && C1 <= D2 || D1 >= C2 && D1 <= D2)
		{
			return true;
		}
	}
	return false;
}

/**
 * Tank vs map tile collision
 * @param tank tank object
 * @param mapobj map object
 * @returns {Boolean} true if collision detected
 */
function tankMapCollision(tank,mapobj){
	// movement check: record last movement direction and calculate +-overlap based on direction
	var tileNum = 0;  // number of tiles to check
	var rowIndex = 0; // row index in map
	var colIndex = 0; // column index in map
	var overlap = 3;  // allowed overlap size
	
	// calculate map row and col from tank's x, y
	if(tank.dir == UP){
		rowIndex = parseInt((tank.tempY + overlap  - mapobj.offsetY)/mapobj.tileSize);
		colIndex = parseInt((tank.tempX + overlap- mapobj.offsetX)/mapobj.tileSize);
	}else if(tank.dir == DOWN){
		// moving down (dir==1): row index needs +tank.Height
		rowIndex = parseInt((tank.tempY - overlap - mapobj.offsetY + tank.size)/mapobj.tileSize);
		colIndex = parseInt((tank.tempX + overlap- mapobj.offsetX)/mapobj.tileSize);
	}else if(tank.dir == LEFT){
		rowIndex = parseInt((tank.tempY + overlap- mapobj.offsetY)/mapobj.tileSize);
		colIndex = parseInt((tank.tempX + overlap - mapobj.offsetX)/mapobj.tileSize);
	}else if(tank.dir == RIGHT){
		rowIndex = parseInt((tank.tempY + overlap- mapobj.offsetY)/mapobj.tileSize);
		// moving right (dir==3): col index needs +tank.Height
		colIndex = parseInt((tank.tempX - overlap - mapobj.offsetX + tank.size)/mapobj.tileSize);
	}
	if(rowIndex >= mapobj.HTileCount || rowIndex < 0 || colIndex >= mapobj.wTileCount || colIndex < 0){
		return true;
	}
	if(tank.dir == UP || tank.dir == DOWN){
		var tempWidth = parseInt(tank.tempX - map.offsetX - (colIndex)*mapobj.tileSize + tank.size - overlap); // subtract overlap
		if(tempWidth % mapobj.tileSize == 0 ){
			tileNum = parseInt(tempWidth/mapobj.tileSize);
		}else{
			tileNum = parseInt(tempWidth/mapobj.tileSize) + 1;
		}
		for(var i=0;i<tileNum && colIndex+i < mapobj.wTileCount ;i++){
			var mapContent = mapobj.mapLevel[rowIndex][colIndex+i];
			if(mapContent == WALL || mapContent == GRID || mapContent == WATER || mapContent == HOME || mapContent == ANOTHREHOME){
				if(tank.dir == UP){
					tank.y = mapobj.offsetY + rowIndex * mapobj.tileSize + mapobj.tileSize - overlap;
				}else if(tank.dir == DOWN){
					tank.y = mapobj.offsetY + rowIndex * mapobj.tileSize - tank.size + overlap;
				}
				return true;
			}
		}
	}else{
		var tempHeight = parseInt(tank.tempY - map.offsetY - (rowIndex)*mapobj.tileSize + tank.size - overlap); // subtract overlap
		if(tempHeight % mapobj.tileSize == 0 ){
			tileNum = parseInt(tempHeight/mapobj.tileSize);
		}else{
			tileNum = parseInt(tempHeight/mapobj.tileSize) + 1;
		}
		for(var i=0;i<tileNum && rowIndex+i < mapobj.HTileCount;i++){
			var mapContent = mapobj.mapLevel[rowIndex+i][colIndex];
			if(mapContent == WALL || mapContent == GRID || mapContent == WATER || mapContent == HOME || mapContent == ANOTHREHOME){
				if(tank.dir == LEFT){
					tank.x = mapobj.offsetX + colIndex * mapobj.tileSize + mapobj.tileSize - overlap;
				}else if(tank.dir == RIGHT){
					tank.x = mapobj.offsetX + colIndex * mapobj.tileSize - tank.size + overlap;
				}
				return true;
			}
		}
	}
	return false;
}

/**
 * Bullet vs map tile collision
 * @param bullet bullet object
 * @param mapobj map object
 */
function bulletMapCollision(bullet,mapobj){
	var tileNum = 0;          // number of tiles to check
	var rowIndex = 0;         // row index in map
	var colIndex = 0;         // column index in map
	var mapChangeIndex = [];  // array of map indexes that need to be updated
	var result = false;       // whether a collision occurred
	// calculate map row and col from bullet's x, y
	if(bullet.dir == UP){
		rowIndex = parseInt((bullet.y - mapobj.offsetY)/mapobj.tileSize);
		colIndex = parseInt((bullet.x - mapobj.offsetX)/mapobj.tileSize);
	}else if(bullet.dir == DOWN){
		// moving down (dir==1): row index needs +bullet.Height
		rowIndex = parseInt((bullet.y - mapobj.offsetY + bullet.size)/mapobj.tileSize);
		colIndex = parseInt((bullet.x - mapobj.offsetX)/mapobj.tileSize);
	}else if(bullet.dir == LEFT){
		rowIndex = parseInt((bullet.y - mapobj.offsetY)/mapobj.tileSize);
		colIndex = parseInt((bullet.x - mapobj.offsetX)/mapobj.tileSize);
	}else if(bullet.dir == RIGHT){
		rowIndex = parseInt((bullet.y - mapobj.offsetY)/mapobj.tileSize);
		// moving right (dir==3): col index needs +bullet.Height
		colIndex = parseInt((bullet.x - mapobj.offsetX + bullet.size)/mapobj.tileSize);
	}
	if(rowIndex >= mapobj.HTileCount || rowIndex < 0 || colIndex >= mapobj.wTileCount || colIndex < 0){
		return true;
	}
	
	if(bullet.dir == UP || bullet.dir == DOWN){
		var tempWidth = parseInt(bullet.x - map.offsetX - (colIndex)*mapobj.tileSize + bullet.size);
		if(tempWidth % mapobj.tileSize == 0 ){
			tileNum = parseInt(tempWidth/mapobj.tileSize);
		}else{
			tileNum = parseInt(tempWidth/mapobj.tileSize) + 1;
		}
		for(var i=0;i<tileNum && colIndex+i < mapobj.wTileCount ;i++){
			var mapContent = mapobj.mapLevel[rowIndex][colIndex+i];
			if(mapContent == WALL || mapContent == GRID || mapContent == HOME || mapContent == ANOTHREHOME){
				//bullet.distroy();
				result = true;
				if(mapContent == WALL){
					// wall gets destroyed
					mapChangeIndex.push([rowIndex,colIndex+i]);
				}else if(mapContent == GRID){
					
				}else{
					isGameOver = true;
					break;
				}
			}
		}
	}else{
		var tempHeight = parseInt(bullet.y - map.offsetY - (rowIndex)*mapobj.tileSize + bullet.size);
		if(tempHeight % mapobj.tileSize == 0 ){
			tileNum = parseInt(tempHeight/mapobj.tileSize);
		}else{
			tileNum = parseInt(tempHeight/mapobj.tileSize) + 1;
		}
		for(var i=0;i<tileNum && rowIndex+i < mapobj.HTileCount;i++){
			var mapContent = mapobj.mapLevel[rowIndex+i][colIndex];
			if(mapContent == WALL || mapContent == GRID || mapContent == HOME || mapContent == ANOTHREHOME){
				//bullet.distroy();
				result = true;
				if(mapContent == WALL){
					// wall gets destroyed
					mapChangeIndex.push([rowIndex+i,colIndex]);
				}else if(mapContent == GRID){
					
				}else{
					isGameOver = true;
					break;
				}
			}
		}
	}
	// update the map
	map.updateMap(mapChangeIndex,0);
	return result;
}
