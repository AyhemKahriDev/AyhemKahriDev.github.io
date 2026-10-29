let colors = [
	"#E23A59", 
	"#44ADAD", 
	"#3E506B", 
	"#FCC82B", 
	"#0F5E8C"
];

/*food object*/
class food {
	constructor(x,y) {
		this.x = x;
		this.y = y;
		this.mass = Math.floor((Math.random() * 3)+ 6);
		this.color = colors[Math.floor(Math.random() * colors.length)];
	}
}