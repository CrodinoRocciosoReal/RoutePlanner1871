
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    const addressInput = document.getElementById('address-input');
    const transportMode = document.getElementById('transport-mode');
    const calculateBtn = document.getElementById('calcolaBtn');
    const resetBtn = document.getElementById('resetBtn');

    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => {
            mainNav.classList.toggle('active');
        });
    }

    // Load saved addresses if they exist
    if (addressInput) {
        const savedAddresses = localStorage.getItem('indirizzi');
        if (savedAddresses) {
            addressInput.value = savedAddresses;
        }
    }

    if (calculateBtn) {
        calculateBtn.addEventListener('click', () => {
            if (addressInput && addressInput.value.trim()) {
                localStorage.setItem('indirizzi', addressInput.value);
                
                // Map custom transport modes to OSRM compatible profiles
                let osmrProfile = transportMode.value;
                if (transportMode.value === "driving-hgv" || transportMode.value === "driving-lgv") {
                    // OSRM public API doesn't directly support HGV/LGV profiles
                    // For now, we'll use the "driving" profile with a special flag
                    osmrProfile = "driving";
                    localStorage.setItem('isHeavyVehicle', 'true');
                } else {
                    localStorage.removeItem('isHeavyVehicle');
                }
                
                localStorage.setItem('transportMode', osmrProfile);
                window.location.href = 'map.html';
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (addressInput) {
                addressInput.value = '';
                localStorage.removeItem('indirizzi');
            }
        });
    }
});
