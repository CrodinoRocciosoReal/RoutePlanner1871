
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
                localStorage.setItem('transportMode', transportMode.value);
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
