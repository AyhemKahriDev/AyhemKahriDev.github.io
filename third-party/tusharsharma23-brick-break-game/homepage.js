
function playLevel() {
    var optionMenu = document.getElementById("selectLevel");
    var optionSelected = optionMenu.options[optionMenu.selectedIndex].value;
    window.location.href = "index.html?"+optionSelected;
}

function playArcade() {
	window.location.href = "index.html?0";
}