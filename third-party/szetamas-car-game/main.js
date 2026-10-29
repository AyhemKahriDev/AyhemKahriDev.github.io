///it is just random numbers generator
function rando(a)
{
		return Math.floor(Math.random()*a);
}

///this is object constructor with id
///and sav that is mean the object location(path) in the road

///and some method hitCheck: check that this obj "hitting" the target
///goDown: an object go to down some speed and that change path(maybe)
///spawn: take an object into a path and coords
///move: move left and right an object(player's car)
function objektum(id, sav){
    this.id=id;
    this.sav=sav;
    //target obj(it is the another car(example:ancar0))
    this.hitCheck=function(targetObj)
    {
		//check that this object "hits" the targe tobject
		var targetpos=$("#"+targetObj.id).position();
		var thispos=$("#"+this.id).position();
		//if the 2 object paths are equal and the target top position+target height(282)  more than this top position-20 and target pos less than this+this height-20
		if( targetObj.sav==this.sav && targetpos.top+$("#"+targetObj.id).height()>thispos.top-20 && targetpos.top<thispos.top+$("#"+this.id).height()-20 )
		{
			//stop methods
			clearInterval(hchecking);
			
			//stop the animations
			$("#"+this.id).stop();
			$("#"+targetObj.id).stop();
			
			//switch on the filter and the menu
			$("img").css("filter", "grayscale(1)");
			$("#divcentrum").css("visibility","visible");
			$("#out2").text("Failed, push enter to restart(or click here)!");
		
			//its need that on phone when the car has an accident
			//but the user try escape and tap left and right sides, after not start an another mode and speed
			if(phone)
			{
				$(".available").prop("disabled",true);
				setTimeout("$('.available').prop('disabled',false)", 800);
			}
		}
	};
	
	//obj(that is need recall),fromY(it is the start point),toY(it is the destination)
	//tempo(it is the speed), valtas(that is mean maybe need path change or not)
    this.goDown=function(obj, fromY, toY, tempo, valtas=false)
    {
		//add some points
		point++;
		$("#out").text("Points: "+point);
		
		//if tempo is not very very fast
		if(tempo>400)
		{
			//then speedup
			tempo-=10;
		}
		
		//i need a random path
		var whichSav=rando(3)+1;
		

		//need a rando 50%(changing the path), but i dont need this with traditional mode
		var valte=rando(2);
		
		//and go on 1 of these paths
		switch(whichSav)
		{
			case 1:
				//go to the begin of first path
				this.spawn(1,100,fromY);
				if(valtas)
				{
					//if changer variable more than 0 (so he get value), start a path canging later(valtas time)
					//and 50% chance that path is change(because it is first path case)
					if(valte>0)
					{
						//go to down a little and later change the path and go to the bottom 
						$("#"+this.id).animate({top: parseInt(((toY/10)*3)-282)+"px"}, parseInt((tempo/10)*3), "linear");
						$("#"+this.id).animate({top: parseInt(((toY/10)*6)-282)+"px",left: "250px"}, parseInt((tempo/10)*3), "linear");

						$("#"+this.id).animate({top: toY+"px"},
						{
							duration: parseInt((tempo/10)*6),
							easing: "linear",
							complete: function()
							{
								obj.goDown(obj, fromY, toY, tempo, valtas);
							}
						});
						//path will be 2
						this.sav=2;
					}
			
				}
			
				break;
			case 2:
				this.spawn(2,250,fromY);
				if(valtas)
				{
					if(valte>0)
					{
						$("#"+this.id).animate({top: parseInt(((toY/10)*3)-282)+"px"}, parseInt((tempo/10)*3), "linear");
            
						//i need 50-50 random num that chose the side
						if(rando(2)>0)
						{
							//left side
							$("#"+this.id).animate({top: parseInt(((toY/10)*6)-282)+"px",left: "100px"}, parseInt((tempo/10)*3), "linear");
							this.sav=1;
						}
						else
						{
							//right side
							$("#"+this.id).animate({top: parseInt(((toY/10)*6)-282)+"px",left: "400px"}, parseInt((tempo/10)*3), "linear");
							this.sav=3;
						}

						$("#"+this.id).animate({top: toY+"px"},
						{
							duration: parseInt((tempo/10)*6),
							easing: "linear",
							complete: function()
							{
								obj.goDown(obj, fromY, toY, tempo, valtas);
							}
						});
						

					}
				}
				break;
			case 3:	
				this.spawn(3,400,fromY);

				if(valtas)
				{
					if(valte>0)
					{
						//goto left
						$("#"+this.id).animate({top: parseInt(((toY/10)*3)-282)+"px"}, parseInt((tempo/10)*3), "linear");
						$("#"+this.id).animate({top: parseInt(((toY/10)*6)-282)+"px",left: "250px"}, parseInt((tempo/10)*3), "linear");

						$("#"+this.id).animate({top: toY+"px"},
						{
							duration: parseInt((tempo/10)*6),
							easing: "linear",
							complete: function()
							{
								obj.goDown(obj, fromY, toY, tempo, valtas);
							}
						});
						this.sav=2;
					}
			
				}
			
				break;
		}


		if(!valtas || valte==0)
		{
			//if change is not true(so false(so default)) goto down just simple(boost with *1.2 bceause the real mode needs it)
			$("#"+this.id).animate({top: toY+"px"},
			{
				duration: tempo*1.2,
				easing: "linear",
				//recall(if this object has an accident, then do not recall again)
				complete: function()
				{
					//need obj that i call the godown again and again, maybe this.godown means here that animation element or something else
					obj.goDown(obj, fromY, toY, tempo, valtas);
				}
			});
		}
	};
	
	//toSav(it is the path(on road)), x,y(coords)
    this.spawn=function(toSav, x, y)
    {
		//take to the path
		this.sav=toSav
		//and go to coord
		$("#"+this.id).offset({left:x,top:y});		
	};
	
	//toSav(path), tempo(it is mean the speed)
	this.move=function(toSav, tempo)
	{
		//check that actual path(sav) + move(left or right 1 path) it is 1. 2. or 3. path
		switch(this.sav+toSav)
		{
			case 1:
				//go to the first path
				$("#"+this.id).animate({left: "100px"}, tempo);
				//and change the path value
				this.sav=this.sav+toSav;
				//check that it is not an accident
			    this.hitCheck(ancar);
				break;
			case 2:
				$("#"+this.id).animate({left: "250px"}, tempo);
				this.sav=this.sav+toSav;
				this.hitCheck(ancar);
				break;
			case 3:
				$("#"+this.id).animate({left: "400px"}, tempo);
				this.sav=this.sav+toSav;
				this.hitCheck(ancar);
				break;
		}	
	};
}

///this is starting(and initialization method) with game mode, speed and car number
function start(mode,tempo,cars=1)
{

	//clear the points
	point=0;

	switch(mode)
		{
			case "traditional":
				
				//i create a car into the first path
				car = new objektum("car",1);
				//and create an other car
				ancar = new objektum("ancar0",1);
				
				//initialiation(take cars to the path and correct x,y coord)
				car.spawn(1,100,500);
				ancar.spawn(1,100,-282);
				
				//switch off the filter and the menu
				$("img").css("filter", "grayscale(0)");
				$("#divcentrum").css("visibility","hidden");
			
				//body always get an onkeydown attribute and out2 text always get onclick
				$("body").attr("onkeydown","if(event.which == 13 && $('img').css('filter') == 'grayscale(1)'){start('traditional','"+tempo+"');}");
				$("#out2").attr("onclick","if($('img').css('filter') == 'grayscale(1)'){start('traditional','"+tempo+"');}");
				
				//start the driving(paramters:obj,fromY,toY,tempo and optional valtas)
				ancar.goDown(ancar,-282,800,parseInt(tempo));
				//it checks that the car hit the another car or not (need a better hitchecking technique)

				hchecking=setInterval("car.hitCheck(ancar);", 30);
				
				break;
				
			case "real":
				
				//create cars
				car = new objektum("car",1);
				ancar = new objektum("ancar0",1);
				
				//initialiation
				car.spawn(1,100,500);
				ancar.spawn(1,100,-282);
				
				//off menu
				$("img").css("filter", "grayscale(0)");
				$("#divcentrum").css("visibility","hidden");

				
				//body get an onkeydown, out2 get onclick
				$("body").attr("onkeydown","if(event.which == 13 && $('img').css('filter') == 'grayscale(1)'){start('real','"+tempo+"');}");
				$("#out2").attr("onclick","if($('img').css('filter') == 'grayscale(1)'){start('real','"+tempo+"');}");
			
				ancar.goDown(ancar,-282,800,parseInt(tempo),true);
				hchecking=setInterval("car.hitCheck(ancar);", 30);
				

				break;
		}	
}


$(document).ready(function()
{	

	//check that this device it is a phone(or tablet etc)
	function itIsPhone()
	{
		try
		{
			document.createEvent("TouchEvent");
			return true;
		}
		catch(e)
		{
			return false;
		}
	}
	//and if phone write that drive the car with touch another else drive with keys
	phone=itIsPhone();
	if(phone)
	{
		$("#out").text("Tap left and right sides of the screen to drive to left and right the car.");
	}
	else
	{
		$("#out").text("Press left and right keys to drive to left and right the car.");
	}
	
	//hovered button
	$(".available").hover(function()
	{
		$(this).css("background-color", "#444444");
	},function()
	{
        $(this).css("background-color", "#666666");
    });
	

	
	//phone
	$("body").on("touchstart", function(e)
	{	

		if(e.touches[0])
		{
			
			if( e.touches[0].clientX <=325 && $("img").css("filter") == "grayscale(0)" )		//LEFT
			{
				//if the touch x coord is 325 or less(it is the half of picture) and the img's doesnt have grayscale, then goto left with move method
				car.move(-1,80);
			
			}
		
			if( e.touches[0].clientX >325 && $("img").css("filter") == "grayscale(0)" )		//RIGHT
			{
				//if the touch x cord more thane 325 and the img's doesnt have grayscale, then goto right with move method
				car.move(1,80);
			
			}
		}

	});
	
	//pc
	$("body").on("keydown", function(e)
	{	

		
		if( e.which == 37 && $("img").css("filter") == "grayscale(0)" )		//LEFT

		{
			//if the keydown is 37 keycode(left) and the img's doesnt have grayscale, then goto left with move method
			car.move(-1,80);
			
		}
		

		if( e.which == 39 && $("img").css("filter") == "grayscale(0)" )		//RIGHT

		{
			//if the keydown is 39 keycode(right) and the img's doesnt have grayscale, then goto right with move method
			car.move(1,80);
			
		}
		
    });
	
}); 