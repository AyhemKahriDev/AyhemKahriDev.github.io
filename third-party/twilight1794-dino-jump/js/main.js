/* Oculta el aviso de JavaScript a los navegadores que sí lo soportan */
function jsRequired(){
    var ggg = document.getElementById("jsrequired");
    ggg.parentNode.removeChild(ggg);
}

/* Comprueba y envían el formulario */
function checkForm(){
    var primero = true;
    /* Asegura que se haya seleccionado un personaje */
    var radiobuttons = document.getElementsByName("personaje");
    for(var i = 0; i < radiobuttons.length; i++) {
        if (radiobuttons[i].checked == true) {
            break;
        } else {
            if (primero == false){
                return false;
            } else {
                primero = false;
                continue;
            }
        }
    }
    /* Asegura que se haya seleccionado un paisaje */
    primero = true;
    var radiobuttons2 = document.getElementsByName("paisaje");
    for(var i = 0; i < radiobuttons2.length; i++) {
        if (radiobuttons2[i].checked == true) {
            return true;
        } else {
            if (primero == false){
                return false;
            } else {
                primero = false;
                continue;
            }
        }
    }
}

function submitForm(){
    /* Si todo está correcto, se envía el formulario */
    if (checkForm() == true){
        ggg = document.getElementById("ajugar");
        ggg.value = "Enviando...";
        ggg.form.submit()
    }
}

window.onload = function() {
    jsRequired();
    buttonsubmit = document.getElementById("ajugar");
    buttonsubmit.onclick = submitForm;
}
