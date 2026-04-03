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
    let pendingCoffee = null; // Holds coffee info while user chooses shots

    // --- CUSTOM MODAL LOGIC ---
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

    window.closeModal = () => {
        const modal = document.getElementById('custom-modal');
        if (modal) modal.style.display = 'none';
    };

    // --- SHOT MODAL LOGIC ---
    window.closeShotModal = () => {
        const modal = document.getElementById('shot-modal');
        if (modal) modal.style.display = 'none';
        // Note: We don't null pendingCoffee here because confirmShot might need it
    };

    // New: Logic to intercept Double Shot selection
    window.confirmShot = (shotType) => {
        if (shotType === 'Double') {
            const infoModal = document.getElementById('info-modal');
            const infoMsg = document.getElementById('info-message');
            if (infoModal && infoMsg) {
                // Close shot modal and show 12g info
                document.getElementById('shot-modal').style.display = 'none';
                infoMsg.innerText = "Double shot espresso is 12g. ☕";
                infoModal.style.display = 'flex';
            }
        } else {
            window.selectShot('Single');
        }
    };

    // New: Proceed after viewing the 12g info
    window.proceedWithDoubleShot = () => {
        const infoModal = document.getElementById('info-modal');
        if (infoModal) infoModal.style.display = 'none';
        window.selectShot('Double');
    };

    window.selectShot = (shotType) => {
        if (pendingCoffee) {
            let finalPrice = pendingCoffee.basePrice;
            
            // Add 1 Kiss for Double Shot
            if (shotType === 'Double') {
                finalPrice += 1;
            }

            orderArray.push({
                name: pendingCoffee.name,
                temp: pendingCoffee.temp,
                shot: shotType,
                price: finalPrice
            });

            renderSlip();
            window.closeShotModal();
            pendingCoffee = null; // Clear now that it's in the tray
        }
    };

    // 1. Set Temperature & Unlock Menu
    tempBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tempBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentTemp = btn.getAttribute('data-temp');

            cards.forEach(card => card.classList.remove('disabled'));
            document.querySelector('.temp-toggle')?.classList.remove('highlight');
        });
    });

    // 2. Add to Order (Trigger Shot Selection)
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

            card.style.background = "#fffaf5";
            setTimeout(() => card.style.background = "white", 200);
        });
    });

    // 3. Render the Slip
    function renderSlip() {
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
                <div>
                    <div class="item-name">${item.name} (${item.price} 💋)</div>
                    <div class="item-meta">${item.temp} • ${item.shot} Shot</div>
                </div>
                <div style="cursor:pointer; color:#ff4444; font-weight:bold; padding: 5px;" onclick="removeItem(${index})">✕</div>
            `;
            slipItemsContainer.appendChild(itemDiv);
        });

        const totalDiv = document.createElement('div');
        totalDiv.className = "total-row";
        totalDiv.innerHTML = `TOTAL: ${totalKisses} 💋`;
        slipItemsContainer.appendChild(totalDiv);

        cartCountLabel.textContent = `Items in tray: ${orderArray.length}`;
    }

    window.removeItem = (index) => {
        orderArray.splice(index, 1);
        renderSlip();
    };

    // 4. Clear All Logic
    clearBtn.addEventListener('click', () => {
        orderArray = [];
        currentTemp = null;
        tempBtns.forEach(b => b.classList.remove('selected'));
        cards.forEach(card => card.classList.add('disabled'));
        renderSlip();
    });

    // 5. Final Send & Redirect
    orderBtn.addEventListener('click', () => {
        if (orderArray.length === 0) {
            showAlert("Your tray is empty! Add some coffee first. ☕");
            return;
        }

        const orderList = orderArray.map((item, i) => 
            `${i + 1}. ${item.temp} ${item.name} (${item.shot}) - ${item.price} 💋`
        ).join('\n');
        
        const notes = document.getElementById('custom-notes').value;
        const currentDate = new Date().toLocaleString();

        const orderRecord = {
            details: orderList,
            notes: notes || "No special instructions",
            total: `${totalKisses} 💋`,
            date: currentDate
        };
        localStorage.setItem('lastOrder', JSON.stringify(orderRecord));

        const templateParams = {
            order_details: orderList,
            total_kisses: `${totalKisses} 💋`, 
            notes: notes || "No special instructions provided.",
            to_email: "secondryme@example.com",
            date: currentDate
        };

        orderBtn.innerText = "Sending...";
        orderBtn.disabled = true;

        emailjs.send('service_pybp3np', 'template_ccvs6zk', templateParams)
            .then(function() {
                window.location.href = "receipt.html";
            }, function(error) {
                console.log('FAILED...', error);
                orderBtn.innerText = "Send Order";
                orderBtn.disabled = false;
                showAlert("Order failed to send. Please check your connection. 🌐");
            });
    });
});
