let map;
let line; // Variable para la línea entre el punto seleccionado y la capital

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 48.924646, lng: 8.561119 },
        zoom: 3,
        styles: [
            { "elementType": "labels", "stylers": [{ "visibility": "off" }] },
            { "featureType": "road", "stylers": [{ "visibility": "off" }] }
        ]
    });
}

window.onload = function () {
    let capitals = [];
    let selectedCapitals = [];
    let km = 5000;
    let index = 0;

    fetch('capitals.json')
        .then(response => response.json())
        .then(data => {
            capitals = data;
            selectedCapitals = getRandomCapitals(capitals, 5);
            startGame();
        })
        .catch(error => {
            console.error('Error cargando las ciudades:', error);
            displayMessage('popup', '<p class="bad">Error cargando las ciudades. Intenta recargar la página.</p>');
        });

    function getRandomCapitals(capitalsArray, numberOfCapitals) {
        for (let i = capitalsArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [capitalsArray[i], capitalsArray[j]] = [capitalsArray[j], capitalsArray[i]];
        }
        return capitalsArray.slice(0, numberOfCapitals);
    }

    function startGame() {
        welcomeMessage();
    }

    function displayMessage(elementId, message) {
        const element = document.getElementById(elementId);
        if (message.trim()) {
            element.innerHTML = message;
            element.style.display = 'block';
        }

        ['result', 'city', 'distance'].forEach(id => {
            const el = document.getElementById(id);
            if (!el.innerHTML.trim()) {
                el.style.display = 'none';
            }
        });
    }

    function welcomeMessage() {
        const message = `
            <p>El juego de las capitales!</p><br>
            <p>Empiezas el juego con 5000kms. Cada vez que cliques, los kilómetros entre el punto elegido y la capital a buscar se van reduciendo.</p><br>
            <p>Si te quedas sin kilómetros pierdes!</p><br>
            <p>¿Preparad@ para buscar la primera capital?</p>
            <button id="startGameBtn">Vamos!</button>
        `;
        displayMessage('popup', message);

        document.getElementById('startGameBtn').onclick = function () {
            document.getElementById('popup').style.display = 'none';
            initializeNextCapital();
        };
    }

    function initializeNextCapital() {
        if (index < 5) {
            const cityMessage = `
                <p><strong>Localiza ${selectedCapitals[index].capitalCity}</strong></p>
                <button id="nextCapitalBtn">Ok!</button>
            `;
            displayMessage('city', cityMessage);

            document.getElementById('nextCapitalBtn').onclick = function () {
                document.getElementById('city').style.display = 'none';
                map.addListener('click', handleClick);
            };
        } else {
            const finalMessage = `
                <p class="good"><strong>¡Felicidades!</strong></p>
                <p><strong>Tu puntuación es ${km} kms!</strong></p><br>
                <p>Coded by <a href="https://jjmontalban.github.io/">JJMöntabán</a></p>
            `;
            displayMessage('result', finalMessage);

            document.getElementById('distance').style.display = 'none';
            document.getElementById('city').style.display = 'none';
        }
    }

    function handleClick(e) {
        const posA = new google.maps.LatLng(selectedCapitals[index].lat, selectedCapitals[index].long);
        const posB = e.latLng;

        // Limpiar la línea anterior si existe
        if (line) {
            line.setMap(null);
        }

        // Dibujar una línea entre el punto seleccionado y la capital
        line = new google.maps.Polyline({
            path: [posA, posB],
            geodesic: true,
            strokeColor: '#FF0000',
            strokeOpacity: 1.0,
            strokeWeight: 2,
            map: map
        });

        // Marcadores
        new google.maps.Marker({
            position: posB,
            map: map,
            title: 'Attempt',
            animation: google.maps.Animation.DROP,
            icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
        });

        new google.maps.Marker({
            position: posA,
            map: map,
            title: 'Reference',
            animation: google.maps.Animation.DROP,
            draggable: false
        });

        // Calcular la distancia
        const distance = (google.maps.geometry.spherical.computeDistanceBetween(posA, posB) / 1000).toFixed(2);

        let isGood = false;
        if (distance < 100) {
            isGood = true;
        } else {
            km -= distance;
            km = km.toFixed(2);
        }

        const combinedMessage = `
            <p>${distance} kms. desde tu posición hasta ${selectedCapitals[index].capitalCity}!</p>
            <p class="${isGood ? 'good' : 'bad'}">${isGood ? 'Buena jugada! No tienes reducción de kms.' : `Te quedan ${km} kms!`}</p>
            <button id="nextAttemptBtn">Siguiente!</button>
        `;
        displayMessage('distance', combinedMessage);

        google.maps.event.clearListeners(map, 'click');

        document.getElementById('nextAttemptBtn').onclick = function () {
            document.getElementById('distance').style.display = 'none';
            index++;
            initializeNextCapital();
        };

        if (km < 0) {
            displayMessage('result', `
                <p class="bad"><strong>Se acabaron los kilómetros!</strong></p><br>
                <p>Coded by <a href="https://jjmontalban.github.io/">JJMöntabán</a></p>
            `);

            document.getElementById('city').style.display = 'none';
            document.getElementById('distance').style.display = 'none';
            return;
        }
    }
};