class Vector {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  add(v) {
    this.x = this.x + v.x;
    this.y = this.y + v.y;
  }

  sub(v) {
    this.x = this.x - v.x;
    this.y = this.y - v.y;
  }
  returnSub(v) {
    return new Vector(this.x - v.x, this.y - v.y);
  }

  mult(n) {
    this.x = this.x * n;
    this.y = this.y * n;
  }

  div(n) {
    this.x = this.x / n;
    this.y = this.y / n;
  }

  mag() {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }

  normalize() {
    let m = this.mag();
    if(m != 0) {
      this.div(m);
    }
  }

  limit(max) {
    if( (this.mag()**2) > max**2 ) {
      this.normalize();
      this.mult(max);
    }
  }

  get() {
    return new Vector(this.x, this.y);
  }

  dist(v) {
    let dx = this.x - v.x;
    let dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy*dy);
  }

  rotate(theta) {
    let temp = this.x;
    this.x = this.x * Math.cos(theta) - this.y * Math.sin(theta);
    this.y = temp * Math.sin(theta) + this.y * Math.cos(theta);
  }

  angleTo(t) {
    if(this.x === 0 && this.y === 0) {
      return 0.0;
    }

    if(t.x === 0 && t.y === 0) {
      return 0.0;
    }

    let dot = this.x * t.x + this.y * t.y;
    let thisMag = Math.sqrt(this.x * this.x + this.y * this.y);
    let tMag = Math.sqrt(t.x * t.x + t.y * t.y);
    let amt = dot / (thisMag * tMag);
    if (amt <= -1) {
      return Math.PI;
    } else if (amt >= 1) {
      return 0;
    }
    return Math.acos(amt) * (180 / Math.PI);
  }

  heading() {
    let angle = Math.atan2(this.x,this.y);
    return angle * (180 / Math.PI);
  }

}
