export class Timer {

    start;
    current;
    endTime
    text;
    increment = 1000;

    constructor ( props ) {
        this.start = props.startTime || new Date().getTime();
    }

    update () {
        this.endTime = new Date();
        
        const timeDiff = (this.endTime - this.start) / 1000; 
        
        let seconds = Math.round(timeDiff);

        let minutes = (seconds - seconds % 60) / 60;


        const format = (value) => {
            if (value < 10) {
                return `0${value}`
            }
            return value
        }

        seconds = seconds % 60;

        this.text = `${format(minutes)}:${format(seconds)}`;
    }
}