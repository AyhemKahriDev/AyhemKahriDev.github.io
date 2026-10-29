import { Snake } from "./abstract/snake.js";
import { Food } from "./abstract/food.js";
import { Timer } from "./abstract/timer.js";

const canvas = document.getElementById("game-screen");
const ctx = canvas.getContext("2d");


const canvasWidth = 400;
const canvasHeight = 400;

canvas.width = canvasWidth;
canvas.height = canvasHeight;

const area = {
    x: 10, 
    y: 10
};


const initButton = document.getElementById('init-game');
const timerHtmlElement = document.getElementById('time');
const modal = document.getElementById('beginInfo');

initButton.addEventListener('click', () => {
    document.getElementById('score__data').innerText = 0;
    modal.classList.toggle('hide');

    const timer = new Timer({})

    const funId = setInterval(() => {
        timer.update();
        timerHtmlElement.innerText = timer.text;
    }, timer.increment );

    const snake = new Snake({ 
        area, ctx, 
        border: {x: canvasWidth, y: canvasHeight} , 
        headColor : '#444c24'
    });
    
    const food = new Food({
        ctx, 
        border: {x: canvasWidth, y: canvasHeight},
        area,
    });

    let initialSpeed = 150;

    document.addEventListener('keydown', (e) => {

        let direction = {
            x: 0,
            y: 0
        }
    
        switch (e.key) {
            case 'ArrowUp': direction.y = -1;
              break;
            case 'ArrowDown': direction.y = 1;
              break;
            case 'ArrowLeft': direction.x = -1;
              break;
            case 'ArrowRight': direction.x = 1 
              break;
        }
        snake.setDirection(direction);
    });
    
    function animate() {

        if ( snake.dead ) {
            modal.classList.toggle('hide');
            modal.querySelector('.score.data').innerText = snake.total - 1;
            modal.querySelector('.time.data').innerText = timer.text;
            clearInterval(funId)
            return;
        };
    

        setTimeout(() => {
            requestAnimationFrame(animate);
            ctx.clearRect(0,0, canvas.width, canvas.height );
    
            food.update();
            snake.update( food );
    
        }, initialSpeed - snake.total);
        
    }

    animate();
});


