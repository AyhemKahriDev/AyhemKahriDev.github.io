let detectCollosion = (ball, gameObject) => {
    let ball_bottom = ball.position.y + ball.size;
    let ball_top = ball.position.y;

    let gameObject_top = gameObject.position.y;
    let gameObject_left = gameObject.position.x;
    let gameObject_bottom = gameObject.position.y + gameObject.height;
    let gameObject_right = gameObject.position.x + gameObject.width;


    if ((ball_bottom >= gameObject_top && ball_top <= gameObject_bottom) && (ball.position.x >= gameObject_left && ball.position.x + ball.size <= gameObject_right)) {
        return true;
    } else {
        return false;
    }
}