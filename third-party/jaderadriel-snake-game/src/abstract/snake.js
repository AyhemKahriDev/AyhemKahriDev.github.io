export class Snake {

    ctx;
    position = { x: 0, y: 0 }
    tailColor = 'green';
    headColor = '#444c24';
    border = { x: 400, y: 400 };
    area = { x: 20, y: 20 };
    nextDirection = {x : 1 , y: 0};
    direction = {x : 1 , y: 0}
    total = 1;
    speed = this.area.x;

    tail = [ { position:  { x: 0, y: 0 }, direction: this.direction} ];

    dead = false;

    constructor (props) {

        this.ctx = props.ctx;
        this.headColor = props.headColor || this.tailColor;
        this.tailColor = props.tailColor || this.tailColor;
        this.border = props.border || this.border;
        this.area = props.area || this.area;
        this.position = props.position || this.position;
        this.direction = props.direction || this.direction;
        this.speed = this.area.x;
    }

    draw () {

        for (let index = 0; index < this.tail.length ; index++) {
            const element = this.tail[index];
            this.ctx.fillStyle = this.tailColor;
            this.ctx.fillRect(
                element.x ,
                element.y, 
                this.area.x,
                this.area.y ,
            );
            this.ctx.strokeStyle = 'white'
            this.ctx.strokeRect(
                element.x, element.y, 
                this.area.x, this.area.y
            );
        }
        
    }

    shiftPositions () {
        for (let index = 0; index < this.tail.length - 1 ; index++) {
            const nextElement = this.tail[index + 1];

            this.tail[index] = nextElement;
        }
    }

    update ( food ) {
        if ( this.dead ) return;

        if (this.total === this.tail.length) {
            this.shiftPositions();
        }

        if ( this.position.x === food.position.x && this.position.y === food.position.y  ) {
            food.changePosition();
            this.eat();
        }

        const newPosition = {
            x: this.position.x + this.speed * this.direction.x ,
            y: this.position.y + this.speed * this.direction.y 
        }
        
        this.setPosition( newPosition );

        this.tail[this.total - 1] = this.position

        this.changedDirection();

        this.draw()
    }

   

    eat () {
        this.total++;
        document.getElementById('score__data').innerText = this.total - 1
    }

    setDirection (direction) {
        this.nextDirection = direction;
    }

    changedDirection() {

        const unchangedDirection = {x : 0 , y: 0};

        if ( ( this.position.x % this.area.x === 0 ) && ( this.nextDirection.y !== 0 )) {
            this.direction = this.nextDirection;
            this.nextDirection = unchangedDirection;
        }
        if ( ( this.position.y % this.area.y === 0 ) && ( this.nextDirection.x !== 0 )) {
            this.direction = this.nextDirection;
            this.nextDirection = unchangedDirection;
        }
    }

    isTouchingTail (newPosition) {
        for (let index = 0; index < this.tail.length - 1; index++) {
            const e = this.tail[index]
            if ( !(e.x === newPosition.x && e.y === newPosition.y)) continue
            this.dead = true;
        }
        return false;
    } 

    setPosition (newPosition) {
        if ( 0 > newPosition.x || 0 > newPosition.y) {
            this.dead = true;
            return
        };
        
        if (this.isTouchingTail(newPosition)) {
            this.dead;
            return
        }

        if ( ( newPosition.x + this.area.x - this.speed >= this.border.x ) || 
             ( newPosition.y + this.area.y - this.speed >= this.border.y )) {
                this.dead = true;
                return;
             }

        this.position = newPosition;
    }
}



