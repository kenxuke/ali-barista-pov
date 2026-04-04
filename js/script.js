import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCgfJDdnaQQ_FDb-E-cfeABjL9UN9HH4wE",
    authDomain: "barista-pov.firebaseapp.com",
    databaseURL: "https://barista-pov-default-rtdb.firebaseio.com",
    projectId: "barista-pov",
    storageBucket: "barista-pov.firebasestorage.app",
    messagingSenderId: "663000204703",
    appId: "1:663000204703:web:eebec17ee26058adc569aa",
    measurementId: "G-BH84JXTMMG"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.coffee-card');
    const tempBtns = document.querySelectorAll('.temp-btn');
    const orderBtn = document.getElementById('order-btn');
    const clearBtn = document.getElementById('clear-btn');
    const slipItemsContainer = document.getElementById('slip-items');
    const cartCountLabel = document.getElementById('cart-count');

    let orderArray = [];
    let currentTemp = null; 
    let totalKisses = 0;
    let pendingCoffee = null;

    if (!localStorage.getItem('lastOrder')) {
        orderArray = [];
        renderSlip(); 
    }

    // --- GLOBAL FUNCTIONS ---
    window.closeModal = () => {
        const modal = document.getElementById('custom-modal');
        if (modal) modal.style.display = 'none';
    };

    window.closeShotModal = () => {
        const modal = document.getElementById('shot-modal');
        if (modal) modal.style.display = 'none';
    };

    window.removeItem = (index) => {
        orderArray.splice(index, 1);
        renderSlip();
    };

    window.confirmShot = (shotType) => {
        if (shotType === 'Double') {
            const infoModal = document.getElementById('info-modal');
            const infoMsg = document.getElementById('info-message');
            if (infoModal && infoMsg) {
                document.getElementById('shot-modal').style.display = 'none';
                infoMsg.innerText = "Double shot espresso is 12g. ☕";
                infoModal.style.display = 'flex';
            }
        } else {
            window.selectShot('Single');
        }
    };

    window.proceedWithDoubleShot = () => {
        const infoModal = document.getElementById('info-modal');
        if (infoModal) infoModal.style.display = 'none';
        window.selectShot('Double');
    };

    window.selectShot = (shotType) => {
        if (pendingCoffee) {
            let finalPrice = pendingCoffee.basePrice;
            if (shotType === 'Double') finalPrice += 1;

            orderArray.push({
                name: pendingCoffee.name,
                temp: pendingCoffee.temp,
                shot: shotType,
                price: finalPrice
            });

            renderSlip();
            window.closeShotModal();
            pendingCoffee = null;
        }
    };

    function showAlert(message) {
        const modal = document.getElementById('custom-modal');
        const modalMsg = document.getElementById('modal-message');
        if (modal && modalMsg) {
            modalMsg.innerText = message;
            modal.style.display = 'flex';
        } else {
            alert(message);
        }
    }

    tempBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tempBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentTemp = btn.getAttribute('data-temp');
            cards.forEach(card => card.classList.remove('disabled'));
            document.querySelector('.temp-toggle')?.classList.remove('highlight');
        });
    });

    cards.forEach(card => {
        card.addEventListener('click', () => {
            if (!currentTemp) {
                showAlert("Please select Hot or Iced first! 🌡️");
                document.querySelector('.temp-toggle')?.classList.add('highlight');
                return;
            }
            pendingCoffee = {
                name: card.getAttribute('data-value'),
                basePrice: parseInt(card.getAttribute('data-price')) || 0,
                temp: currentTemp
            };
            const shotModal = document.getElementById('shot-modal');
            const shotTitle = document.getElementById('shot-modal-title');
            if (shotModal && shotTitle) {
                shotTitle.innerText = pendingCoffee.name;
                shotModal.style.display = 'flex';
            }
        });
    });

    function renderSlip() {
        if (!slipItemsContainer) return;
        slipItemsContainer.innerHTML = "";
        totalKisses = 0; 

        if (orderArray.length === 0) {
            slipItemsContainer.innerHTML = '<div class="empty-msg">Your tray is empty</div>';
            cartCountLabel.textContent = `Items in tray: 0`;
            return;
        }

        orderArray.forEach((item, index) => {
            totalKisses += item.price;
            const itemDiv = document.createElement('div');
            itemDiv.className = "slip-item";
            itemDiv.innerHTML = `
                <div class="item-info">
                    <div class="item-name">${item.name} (${item.price} 💋)</div>
                    <div class="item-meta">${item.temp} • ${item.shot} Shot</div>
                </div>
                <div class="remove-btn" style="cursor:pointer; color:red;" onclick="removeItem(${index})">✕</div>
            `;
            slipItemsContainer.appendChild(itemDiv);
        });

        const totalDiv = document.createElement('div');
        totalDiv.className = "total-row";
        totalDiv.innerHTML = `TOTAL: ${totalKisses} 💋`;
        slipItemsContainer.appendChild(totalDiv);

        cartCountLabel.textContent = `Items in tray: ${orderArray.length}`;
    }

    clearBtn.addEventListener('click', () => {
        orderArray = [];
        currentTemp = null;
        tempBtns.forEach(b => b.classList.remove('selected'));
        cards.forEach(card => card.classList.add('disabled'));
        renderSlip();
    });

    orderBtn.addEventListener('click', async () => {
        if (orderArray.length === 0) {
            showAlert("Your tray is empty! Add some coffee first. ☕");
            return;
        }

        const notes = document.getElementById('custom-notes').value || "No special instructions";
        const currentDate = new Date().toLocaleString();
        const batchId = "BATCH-" + Date.now(); 
        let singleOrderId = ""; // Track the ID if it's only one item

        orderBtn.innerText = "Sending...";
        orderBtn.disabled = true;

        try {
            const uploadPromises = orderArray.map((item, index) => {
                const uniqueId = `ORD-${Date.now()}-${index}`;
                if (orderArray.length === 1) singleOrderId = uniqueId; // Capture ID for single order
                
                const shotInfo = item.shot === "Double" ? " (Double)" : "";
                
                const itemRecord = {
                    order_id: uniqueId,
                    batch_id: batchId,
                    details: `${item.temp} ${item.name}${shotInfo}`,
                    notes: notes,
                    total: `${item.price} 💋`,
                    date: currentDate,
                    status: "Received"
                };

                return set(ref(db, 'orders/' + uniqueId), itemRecord);
            });

            await Promise.all(uploadPromises);

            // Save info for the status/receipt pages
            localStorage.setItem('lastOrder', JSON.stringify({
                order_id: singleOrderId || null,
                batch_id: batchId,
                date: currentDate,
                notes: notes
            }));

            const emailSummary = orderArray.map(item => 
                `${item.temp} ${item.name} (${item.shot} Shot)`
            ).join(', ');

            await emailjs.send('service_pybp3np', 'template_ccvs6zk', {
                order_id: singleOrderId || batchId, 
                order_details: emailSummary,
                total_kisses: `${totalKisses} 💋`, 
                notes: notes,
                to_email: "secondryme@example.com",
                date: currentDate
            });

            showAlert("Order Sent! ☕✨");
            
            setTimeout(() => {
                // Determine whether to use 'id' or 'batch' in the URL
                if (orderArray.length === 1) {
                    window.location.href = `status.html?id=${singleOrderId}`;
                } else {
                    window.location.href = `status.html?batch=${batchId}`;
                }
            }, 2000);

        } catch (error) {
            console.error('Order Error:', error);
            orderBtn.innerText = "Send Order";
            orderBtn.disabled = false;
            showAlert("Failed to send order. Please try again.");
        }
    });
});