export class Food {

    color;
    ctx;
    radius;
    position = {
        x: 180,
        y: 180
    };
    area = {
        x: 30,
        y: 30
    };

    border = {
        x: 400,
        y: 400
    }

    constructor(props) {
        
        this.ctx = props.ctx;
        this.color = props.color || 'red';
        this.position = props.position || this.position;
        this.area = props.area || this.area;
        this.border = props.border || this.border;
        // this.radius = props.radius || this.area.x / 2;

        this.draw()

    }

    draw () {
    
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(
            this.position.x, this.position.y, 
            this.area.x, this.area.y
        );
        this.ctx.strokeStyle = 'white'
        this.ctx.strokeRect(
            this.position.x, this.position.y, 
            this.area.x, this.area.y
        );
        
    }

    update () {      
        this.draw()
    }

    changePosition () {
        const amountCol = this.border.x / this.area.x;
        const amountRow = this.border.y / this.area.y;

        const newPosition = {
            x: this.getRandomNumber(0, amountCol) * this.area.x,
            y: this.getRandomNumber(0, amountRow) * this.area.x
        }

        this.position = newPosition;
    }

    getRandomNumber( min, max) {
        return Math.floor( Math.random() * (max - min) + min ) ;
    }

}