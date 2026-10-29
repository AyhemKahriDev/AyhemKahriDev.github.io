window.addEventListener("load",Start);

function Start() {	
	
	/*******************
	** MAIN GAME CODE ** 
	********************/
	
	let x,y,len; // will be used initilize snake's position's
	const MaxSnakes = 15; // max number of snake's on menu
	
	for(let i = 0;i<MaxSnakes ;++i) {
		newSnake(false);
	}
	
	/* Start Button for game */
	document.getElementsByClassName('btnStyle')[0].addEventListener('click',beginGame);
	
	/* Menu for the Game */
	(function menu() {
		draw();
		for(let i=0; i<MaxSnakes;++i) {
			snakes[i].randMoveI(); // Make a random move
		}
		frame = requestAnimationFrame(menu);
	})();
	
	(function setDefControl() {
		let selc = document.getElementById('control');
		selc = selc.querySelectorAll('option');
		for(let i=0,e = selc.length; i< e;++i) {
			if(i === controlmode) {
				selc[i].setAttribute("Selected",'true');
			}
		}
		
	})();
	
	function ChangeControl(x) {
		controlmode = parseInt(x.value);
	}
	
	Start.ChangeControl = ChangeControl;
	setLastSetting();
}

/*
** Function that beigin's the game and closes the menu
*/	
let name;
let smax,done = false;
let sno = 0;
let foodintr = null;

function beginGame() {
	if(running && (!gameon)) {
		running = false;
		document.getElementsByClassName('form')[0].style.display = 'block';
	} else {
	if(document.getElementById('name').value != '' && document.getElementById('num').value != '') {
	document.getElementsByClassName('form')[0].style.display = 'none';
	name = document.getElementById('name').value;
	smax = parseInt(document.getElementById('num').value);
	document.getElementById('name').blur();
	document.getElementById('num').blur();
	cancelAnimationFrame(frame);
	storeSettig(name,smax,controlmode);
	if(smax < snakes.length) while(snakes.length != smax) snakes.pop();
	else while(snakes.length != smax) newSnake(false);
	if(!foodintr) foodintr = setInterval(setfood,1000); 
	if(!gameon) { 
		newSnake(true);
		++smax;
	}
	gameon = true;
	running = true;
	ingame();
	} else {
		alert('Please Enter Your Name and number of Snake\'s');
	}
	}
}


// remember last settings 
function setLastSetting() {
	if(localStorage.snake !== undefined) {
	obj = JSON.parse(localStorage.snake);
	document.getElementById('name').value = obj.name;
	document.getElementById('num').value = obj.no;
	controlmode = parseInt(obj.control);
		let selc = document.getElementById('control');
		selc = selc.querySelectorAll('option');
		for(var i=0,e = selc.length; i< e;++i) {
			if(i === controlmode) {
				selc[i].setAttribute("Selected",'true');
			}
		}	
		
	}
}


function storeSettig(name,no,control) {
	localStorage.snake = '{"name":"'+name+'","no":'+no+',"control":'+control+'}';
}