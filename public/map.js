
document.addEventListener("DOMContentLoaded", async () => {
    const map = L.map("map").setView([39.3089, 9.1733], 13);
    let currentRoute = null;
    let vehicleMarker = null;
    let watchId = null;
    let startTime = null;
    let isNavigating = false;

    // Create status elements
    const statusDiv = document.createElement('div');
    statusDiv.className = 'navigation-status';
    statusDiv.innerHTML = `
        <div id="remainingTime">Tempo rimanente: --</div>
        <div id="remainingDistance">Distanza rimanente: --</div>
        <button id="startNavigation">Inizia Navigazione</button>
    `;
    document.querySelector('main').appendChild(statusDiv);

    function speakInstruction(text) {
        const speech = new SpeechSynthesisUtterance(text);
        speech.lang = 'it-IT';
        window.speechSynthesis.speak(speech);
    }

    function showTemporaryPopup(content) {
        const popup = L.popup()
            .setLatLng(map.getCenter())
            .setContent(content)
            .openOn(map);
        
        setTimeout(() => map.closePopup(popup), 3000);
    }

    function updateNavigationStatus(distance, duration) {
        document.getElementById('remainingDistance').textContent = `Distanza rimanente: ${(distance/1000).toFixed(1)}km`;
        document.getElementById('remainingTime').textContent = `Tempo rimanente: ${Math.round(duration/60)} min`;
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const instructionsContainer = document.createElement('div');
    instructionsContainer.className = 'route-instructions';
    instructionsContainer.innerHTML = '<h3>Istruzioni Percorso</h3>';
    document.querySelector('main').appendChild(instructionsContainer);

    // Create vehicle marker icon
    const vehicleIcon = L.divIcon({
        html: '▲',
        className: 'vehicle-marker',
        iconSize: [20, 20]
    });

    document.getElementById('startNavigation').addEventListener('click', () => {
        if (!isNavigating) {
            isNavigating = true;
            startTime = Date.now();
            if ("geolocation" in navigator) {
                watchId = navigator.geolocation.watchPosition((position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    
                    if (!vehicleMarker) {
                        vehicleMarker = L.marker([lat, lon], {icon: vehicleIcon}).addTo(map);
                    } else {
                        vehicleMarker.setLatLng([lat, lon]);
                    }
                    
                    map.setView([lat, lon]);
                    
                    if (currentRoute) {
                        // Update remaining distance and time based on current position
                        // This is a simplified calculation
                        const currentPoint = [lon, lat];
                        const routePoints = currentRoute.geometry.coordinates;
                        const remainingDistance = calculateRemainingDistance(currentPoint, routePoints);
                        const remainingTime = calculateRemainingTime(remainingDistance, currentRoute.duration);
                        updateNavigationStatus(remainingDistance, remainingTime);
                    }
                });
            }
            document.getElementById('startNavigation').textContent = 'Stop Navigazione';
        } else {
            isNavigating = false;
            if (watchId) navigator.geolocation.clearWatch(watchId);
            document.getElementById('startNavigation').textContent = 'Inizia Navigazione';
        }
    });

    const transportMode = localStorage.getItem("transportMode") || "driving";
    const indirizzi = localStorage.getItem("indirizzi");
    if (!indirizzi) return;

    const addressList = indirizzi.split('\n').filter(addr => addr.trim());
    const markers = [];
    const coordinates = [];

    for (const address of addressList) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            const data = await response.json();

            if (data && data[0]) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                
                const marker = L.marker([lat, lon])
                    .bindPopup(address)
                    .addTo(map);
                
                markers.push(marker);
                coordinates.push([lon, lat]);
            }
        } catch (error) {
            console.error(`Error geocoding address: ${address}`, error);
        }
    }

    if (coordinates.length >= 2) {
        const waypoints = coordinates.map(coord => coord.join(',')).join(';');
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&steps=true&geometries=geojson&annotations=true`);
        const data = await response.json();

        if (data.routes && data.routes[0]) {
            const route = data.routes[0];
            currentRoute = route;
            
            // Draw route
            L.geoJSON(route.geometry, {
                style: {
                    color: '#0066ff',
                    weight: 5,
                    opacity: 0.7
                }
            }).addTo(map);

            const totalDistance = (route.distance / 1000).toFixed(1);
            const totalDuration = Math.round(route.duration / 60);
            
            // Show initial popup with route info
            showTemporaryPopup(`
                <div class="route-summary">
                    <strong>Distanza totale:</strong> ${totalDistance}km<br>
                    <strong>Tempo stimato:</strong> ${totalDuration} minuti
                </div>
            `);

            // Italian voice announcement
            speakInstruction(`Percorso calcolato. Distanza totale ${totalDistance} chilometri. Tempo stimato ${totalDuration} minuti.`);

            // Add vehicle marker at start
            if (!vehicleMarker) {
                const startPoint = route.geometry.coordinates[0];
                vehicleMarker = L.marker([startPoint[1], startPoint[0]], {icon: vehicleIcon}).addTo(map);
            }

            const steps = route.legs.flatMap(leg => leg.steps);
            const instructionsHTML = steps.map((step, index) => {
                const distance = (step.distance / 1000).toFixed(1);
                let instruction = 'Procedi dritto';
                if (step.maneuver.type === 'arrive') {
                    instruction = 'Arrivo a destinazione';
                } else if (step.maneuver.modifier) {
                    instruction = `${step.maneuver.modifier === 'straight' ? 'Procedi dritto' : 
                        step.maneuver.modifier === 'left' ? 'Gira a sinistra' :
                        step.maneuver.modifier === 'right' ? 'Gira a destra' :
                        step.maneuver.modifier === 'slight left' ? 'Leggera sinistra' :
                        step.maneuver.modifier === 'slight right' ? 'Leggera destra' :
                        step.maneuver.modifier === 'sharp left' ? 'Svolta secca a sinistra' :
                        step.maneuver.modifier === 'sharp right' ? 'Svolta secca a destra' :
                        'Procedi'} e continua per ${distance}km`;
                }
                
                return `
                    <div class="instruction-step" onclick="speakInstruction('${instruction}'); map.flyTo([${step.maneuver.location[1]}, ${step.maneuver.location[0]}], 18)">
                        ${index + 1}. ${instruction}
                    </div>
                `;
            }).join('');

            instructionsContainer.innerHTML = `
                <h3>Istruzioni Percorso</h3>
                <div class="route-overview">
                    Distanza Totale: ${totalDistance}km<br>
                    Tempo Stimato: ${totalDuration} minuti
                </div>
                ${instructionsHTML}
            `;

            map.fitBounds(L.geoJSON(route.geometry).getBounds(), {
                padding: [50, 50]
            });
        }
    }
});

function calculateRemainingDistance(currentPoint, routePoints) {
    // Simplified distance calculation
    let minDistance = Infinity;
    let remainingDistance = 0;
    let foundCurrent = false;
    
    for (let i = 0; i < routePoints.length - 1; i++) {
        const dist = getDistance(currentPoint, routePoints[i]);
        if (dist < minDistance) {
            minDistance = dist;
            foundCurrent = true;
        } else if (foundCurrent) {
            remainingDistance += getDistance(routePoints[i], routePoints[i + 1]);
        }
    }
    return remainingDistance * 1000; // Convert to meters
}

function calculateRemainingTime(remainingDistance, totalDuration) {
    return (remainingDistance / currentRoute.distance) * totalDuration;
}

function getDistance(point1, point2) {
    const [lon1, lat1] = point1;
    const [lon2, lat2] = point2;
    return Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
}
