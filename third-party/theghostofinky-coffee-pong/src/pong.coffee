#Define variables
bg = "#FFF"
fg = "#000"
paddle1 = paddle2 = 225
ball_x = ball_y = 65
ball_x_speed = ball_y_speed = 6
score1 = score2 = cs = 0
p1up = p1down = p2up = p2down = debug = false
play = ai= true
colors = exports ? this

#Input parsers
document.onkeydown = ->
    if event.keyCode is 87
        p1up = true
    if event.keyCode is 83
        p1down = true
    if ai is false
        if event.keyCode is 38
            p2up = true
        if event.keyCode is 40
            p2down = true
    if event.keyCode is 89
        debug = !debug
        do debugUpdate
    if event.keyCode is 80
        play = !play
    if event.keyCode is 73
        ai = !ai

document.onkeyup = ->
    if event.keyCode is 87
        p1up = false
    if event.keyCode is 83
        p1down = false
    if ai is false
        if event.keyCode is 38
            p2up = false
        if event.keyCode is 40
            p2down = false

#reset ball
resetball = () ->
    ball_x = 75
    ball_y = 75
    ball_x_speed = 6
    ball_y_speed = 6
    cs += 1
    if cs >= colors.length
        cs = 0
    bg = colors[cs].bg
    fg = colors[cs].fg
    
#Debugging
debugDraw = () ->
    paddle1 = document.getElementById("paddle1").value
    paddle2 = document.getElementById("paddle2").value
    ball_x = document.getElementById("ball_x").value
    ball_y = document.getElementById("ball_y").value
    ball_x_speed = document.getElementById("ball_x_speed").value
    ball_y_speed = document.getElementById("ball_y_speed").value
    do drawPongCanvas

debugUpdate = () ->
    document.getElementById("dev-tools").style.display = "block"
    document.getElementById("paddle1").value = paddle1
    document.getElementById("paddle2").value = paddle2
    document.getElementById("ball_x").value = ball_x
    document.getElementById("ball_y").value = ball_y
    document.getElementById("ball_x_speed").value = ball_x_speed
    document.getElementById("ball_y_speed").value = ball_y_speed
    if p1up is true
        document.getElementById("p1up").style.backgroundColor = "#0F0"
    else
        document.getElementById("p1up").style.backgroundColor = "#DDD"
    if p1down is true
        document.getElementById("p1down").style.backgroundColor = "#0F0"
    else
        document.getElementById("p1down").style.backgroundColor = "#DDD"
    if p2up is true
        document.getElementById("p2up").style.backgroundColor = "#0F0"
    else
        document.getElementById("p2up").style.backgroundColor = "#DDD"
    if p2down is true
        document.getElementById("p2down").style.backgroundColor = "#0F0"
    else
        document.getElementById("p2down").style.backgroundColor = "#DDD"

#Game logic
drawPongCanvas = () ->
    c = document.getElementById("PongCanvas")
    ctx = c.getContext("2d")
    ctx.fillStyle = bg
    ctx.fillRect(0,0,700,500)
    ctx.fillStyle = fg
    ctx.fillRect(50,paddle1,10,50)
    ctx.fillRect(640,paddle2,10,50)
    ctx.fillRect(ball_x,ball_y,10,10)
    ctx.font = "500 50px Westminster"
    ctx.fillText(score1,150,50)
    ctx.fillText(score2,500,50)

updateGame = () -> 
    #paddle1 update
    if p1up is true and paddle1 > 5
        paddle1 -= 5
    else if p1down is true and paddle1 < 445
        paddle1 += 5
    #paddle2 update
    if p2up is true and paddle2 > 5
        paddle2 -= 5
    else if p2down is true and paddle2 < 445
        paddle2 += 5
    #top and bottom collision
    if ball_y < 5 or ball_y > 485
        ball_y_speed = -ball_y_speed
    #paddle1 hit
    if ball_x < 60 
        paddletop = paddle1 - 10
        paddlebottom = paddle1 + 50
        if paddletop < ball_y and paddlebottom > ball_y and ball_x > 55
            ball_x_speed = -ball_x_speed
        else 
            if ball_x < 5
                score2 += 1
                do resetball
    #paddle2 hit
    if ball_x > 630
        paddletop = paddle2 - 10
        paddlebottom = paddle2 + 50
        if paddletop < ball_y and paddlebottom > ball_y and ball_x < 635
            ball_x_speed = -ball_x_speed
        else 
            if ball_x > 695
                score1 += 1
                do resetball
    #ball update
    ball_x += ball_x_speed
    ball_y += ball_y_speed

aiLogic = () ->
    if ball_y < paddle2 + 10
        p2up = true
        p2down = false
    else if ball_y > paddle2 + 40
        p2down = true
        p2up = false
    else
        p2up = p2down = false


gameLogic = () ->
    if play is false
        return
    do updateGame
    do drawPongCanvas
    if ai is true
        do aiLogic
    if debug is true
        do debugUpdate
    else
        document.getElementById("dev-tools").style.display = "none"

window.onload = ->
    colors = await fetch("assets/colors.json")
        .then((response)-> response.json())
    setInterval(gameLogic, 1000/60)