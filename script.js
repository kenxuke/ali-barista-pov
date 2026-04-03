document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.coffee-card');
    const tempBtns = document.querySelectorAll('.temp-btn');
    const orderBtn = document.getElementById('order-btn');
    const clearBtn = document.getElementById('clear-btn');
    const slipItemsContainer = document.getElementById('slip-items');
    const cartCountLabel = document.getElementById('cart-count');

    let orderArray = [];
    let currentTemp = null; // Start null to keep menu disabled
    let totalKisses = 0;

    // 1. Set Temperature & Unlock Menu
    tempBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tempBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentTemp = btn.getAttribute('data-temp');

            // Unlock the cards
            cards.forEach(card => {
                card.classList.remove('disabled');
            });
        });
    });

    // 2. Add to Order
    cards.forEach(card => {
        card.addEventListener('click', () => {
            if (!currentTemp) {
                alert("Please select Hot or Iced first!");
                return;
            }
            
            const coffeeName = card.getAttribute('data-value');
            const price = parseInt(card.getAttribute('data-price')) || 0;
            
            orderArray.push({
                name: coffeeName,
                temp: currentTemp,
                price: price
            });

            renderSlip();
            
            // Visual feedback
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
                    <div class="item-meta">${item.temp}</div>
                </div>
                <div style="cursor:pointer; color:#ff4444" onclick="removeItem(${index})">✕</div>
            `;
            slipItemsContainer.appendChild(itemDiv);
        });

        const totalDiv = document.createElement('div');
        totalDiv.style.cssText = "border-top: 1px dashed #333; margin-top: 10px; padding-top: 10px; font-weight: bold; text-align: right;";
        totalDiv.innerHTML = `TOTAL: ${totalKisses} 💋`;
        slipItemsContainer.appendChild(totalDiv);

        cartCountLabel.textContent = `Items in tray: ${orderArray.length}`;
    }

    // Global function to remove specific item
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
        if (orderArray.length === 0) return alert("Your tray is empty!");

        // Format data
        const orderList = orderArray.map((item, i) => `${i + 1}. ${item.temp} ${item.name} (${item.price} 💋)`).join('\n');
        const notes = document.getElementById('custom-notes').value;
        const currentDate = new Date().toLocaleString();

        // Save to LocalStorage for the receipt.html page
        const orderRecord = {
            details: orderList,
            notes: notes || "No special instructions",
            total: `${totalKisses} 💋`,
            date: currentDate
        };
        localStorage.setItem('lastOrder', JSON.stringify(orderRecord));

        // EmailJS Parameters
        const templateParams = {
            order_details: orderList,
            total_kisses: `${totalKisses} 💋`, 
            notes: notes || "No special instructions provided.",
            to_email: "secondryme@example.com",
            date: currentDate
        };

        // Send Email
        emailjs.send('service_pybp3np', 'template_ccvs6zk', templateParams)
            .then(function(response) {
                // Redirect to landing page on success
                window.location.href = "receipt.html";
            }, function(error) {
                console.log('FAILED...', error);
                alert("Order failed to send. Please check your connection.");
            });
    });
});