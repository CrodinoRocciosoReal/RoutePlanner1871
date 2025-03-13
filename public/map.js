
document.addEventListener("DOMContentLoaded", async () => {
    const map = L.map("map").setView([39.3089, 9.1733], 13);
    let currentRoute = null;
    let vehicleMarker = null;
    let watchId = null;
    let startTime = null;
    let isNavigating = false;
    
    // Transport mode indicators
    const transportMode = localStorage.getItem("transportMode") || "driving";
    const isHeavyVehicle = localStorage.getItem("isHeavyVehicle") === "true";

    // Create status elements
    const statusDiv = document.createElement('div');
    statusDiv.className = 'navigation-status';
    statusDiv.innerHTML = `
        <div id="remainingTime">Tempo rimanente: --</div>
        <div id="remainingDistance">Distanza rimanente: --</div>
        <button id="startNavigation">Inizia Navigazione</button>
    `;
    document.querySelector('main').appendChild(statusDiv);

    // Create vehicle marker icons based on vehicle type
    const vehicleIcon = L.divIcon({
        html: isHeavyVehicle ? '🚚' : '🚗',  // Truck emoji for heavy vehicles, car for normal
        className: 'vehicle-marker',
        iconSize: [30, 30]
    });

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

    function calculateRemainingTime(remainingDistance, totalDuration, totalDistance) {
        return (remainingDistance / totalDistance) * totalDuration;
    }

    function getDistance(point1, point2) {
        const [lon1, lat1] = point1;
        const [lon2, lat2] = point2;
        return Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const instructionsContainer = document.createElement('div');
    instructionsContainer.className = 'route-instructions';
    instructionsContainer.innerHTML = '<h3>Istruzioni Percorso</h3>';
    document.querySelector('main').appendChild(instructionsContainer);

    document.getElementById('startNavigation').addEventListener('click', () => {
        if (!isNavigating) {
            if (!currentRoute) {
                showTemporaryPopup("Nessun percorso disponibile per la navigazione");
                return;
            }
            
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
                        const currentPoint = [lon, lat];
                        const routePoints = currentRoute.geometry.coordinates;
                        const remainingDistance = calculateRemainingDistance(currentPoint, routePoints);
                        const remainingTime = calculateRemainingTime(
                            remainingDistance, 
                            currentRoute.duration, 
                            currentRoute.distance
                        );
                        updateNavigationStatus(remainingDistance, remainingTime);
                    }
                }, (error) => {
                    console.error("Errore geolocalizzazione:", error);
                    showTemporaryPopup("Errore nella geolocalizzazione. Controlla le impostazioni del tuo dispositivo.");
                });
            } else {
                showTemporaryPopup("Geolocalizzazione non supportata dal tuo browser");
            }
            
            document.getElementById('startNavigation').textContent = 'Stop Navigazione';
        } else {
            isNavigating = false;
            if (watchId) navigator.geolocation.clearWatch(watchId);
            document.getElementById('startNavigation').textContent = 'Inizia Navigazione';
        }
    });

    const indirizzi = localStorage.getItem("indirizzi");
    if (!indirizzi) {
        showTemporaryPopup("Nessun indirizzo trovato. Torna alla home per inserire gli indirizzi.");
        return;
    }
    
    // Show vehicle type indicator
    const vehicleTypeElement = document.createElement('div');
    vehicleTypeElement.className = 'vehicle-type-indicator';
    vehicleTypeElement.textContent = isHeavyVehicle ? 
        'Modalità veicolo pesante: Percorso adattato per mezzi pesanti' : 
        `Modalità: ${transportMode === 'driving' ? 'Auto' : 
                     transportMode === 'walking' ? 'A piedi' : 'Bicicletta'}`;
    document.querySelector('main').appendChild(vehicleTypeElement);

    // Loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = 'Calcolo percorso in corso...';
    document.body.appendChild(loadingIndicator);

    try {
        const addressList = indirizzi.split('\n').filter(addr => addr.trim());
        const markers = [];
        const coordinates = [];
        
        // Verify addresses first
        let validAddresses = [];
        let invalidAddresses = [];
        
        for (const address of addressList) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
                const data = await response.json();

                if (data && data.length > 0) {
                    validAddresses.push({
                        address: address,
                        lat: parseFloat(data[0].lat),
                        lon: parseFloat(data[0].lon)
                    });
                } else {
                    invalidAddresses.push(address);
                }
            } catch (error) {
                console.error(`Errore geocoding indirizzo: ${address}`, error);
                invalidAddresses.push(address);
            }
        }
        
        // Notify user about invalid addresses if any
        if (invalidAddresses.length > 0) {
            // Crea messaggio di errore più evidente
            const errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            errorEl.innerHTML = `<strong>Attenzione:</strong> I seguenti indirizzi non sono validi e saranno ignorati:<br>${invalidAddresses.join('<br>')}<br><br>Verificare che gli indirizzi esistano o che siano scritti correttamente.`;
            document.querySelector('main').prepend(errorEl);
            
            // Rimuovi il messaggio dopo 10 secondi
            setTimeout(() => {
                if (errorEl.parentNode) {
                    errorEl.parentNode.removeChild(errorEl);
                }
            }, 10000);
            
            showTemporaryPopup(`Trovati ${invalidAddresses.length} indirizzi non validi. Verifica il messaggio sopra.`);
        }
        
        // Continue only with valid addresses
        for (const addr of validAddresses) {
            const marker = L.marker([addr.lat, addr.lon])
                .bindPopup(addr.address)
                .addTo(map);
            
            markers.push(marker);
            coordinates.push([addr.lon, addr.lat]);
        }

        if (coordinates.length >= 2) {
            const waypoints = coordinates.map(coord => coord.join(',')).join(';');
            const routingProfile = transportMode;
            
            // Build the API URL with additional parameters
            let apiUrl = `https://router.project-osrm.org/route/v1/${routingProfile}/${waypoints}?overview=full&steps=true&geometries=geojson&annotations=true`;
            
            // Add heavy vehicle parameters if applicable
            if (isHeavyVehicle) {
                apiUrl += '&exclude=motorway&exclude=tunnel';
                
                try {
                    const testHgvUrl = apiUrl.replace(`/${routingProfile}/`, `/driving-hgv/`);
                    const testResponse = await fetch(testHgvUrl);
                    if (testResponse.ok) {
                        apiUrl = testHgvUrl;
                        console.log("Using HGV-specific routing profile");
                    }
                } catch (error) {
                    console.log("HGV profile not supported, using fallback with restrictions");
                }
                
                showTemporaryPopup('Attenzione: Modalità veicolo pesante attiva - Percorso adattato');
            }
            
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                currentRoute = route;
                
                // Draw route with different color and style based on vehicle type
                L.geoJSON(route.geometry, {
                    style: {
                        color: isHeavyVehicle ? '#007BFF' : '#007BFF', // Blu Acciaio come da palette richiesta
                        weight: isHeavyVehicle ? 6 : 5,
                        opacity: 0.7,
                        dashArray: isHeavyVehicle ? '10, 5' : null
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
                        <div class="instruction-step" data-instruction="${instruction}" data-lat="${step.maneuver.location[1]}" data-lon="${step.maneuver.location[0]}">
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
                
                // Aggiungi ascoltatori di eventi ai passi delle istruzioni
                document.querySelectorAll('.instruction-step').forEach(step => {
                    step.addEventListener('click', function() {
                        const instruction = this.dataset.instruction;
                        const lat = parseFloat(this.dataset.lat);
                        const lon = parseFloat(this.dataset.lon);
                        
                        speakInstruction(instruction);
                        map.flyTo([lat, lon], 18);
                    });
                });

                map.fitBounds(L.geoJSON(route.geometry).getBounds(), {
                    padding: [50, 50]
                });
            } else {
                showTemporaryPopup("Errore nel calcolo del percorso. Verifica gli indirizzi e riprova.");
            }
        } else {
            showTemporaryPopup("Sono necessari almeno due indirizzi validi per calcolare un percorso.");
        }
    } catch (error) {
        console.error("Errore durante il calcolo del percorso:", error);
        showTemporaryPopup("Si è verificato un errore durante il calcolo del percorso. Riprova più tardi.");
    } finally {
        // Remove loading indicator
        if (loadingIndicator && loadingIndicator.parentNode) {
            loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
    }
});
