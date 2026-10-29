class MainMenu {
    constructor() {
        this.title = new Sprite("res/Images/Title.png");

        this.title_xCoordinate = (innerWidth / 4) + 70;
        this.title_yCoordinate = (innerHeight / 4) + 140;

        this.prompt_xCoordinate = (innerWidth / 4);
        this.prompt_yCoordinate = (innerHeight / 4) + 320; 
    }

    toCanvas() {
        this.title.toCanvas(this.title_xCoordinate, this.title_yCoordinate);
        textSize(50);
        if (frameCount % 60 <= 30) {
            fill(255);
            text("Tap anywhere to play",this.prompt_xCoordinate, 
                this.prompt_yCoordinate + 5);
            fill("#F09F46");
            text("Tap anywhere to play", this.prompt_xCoordinate, 
                this.prompt_yCoordinate);
        }
    }
}