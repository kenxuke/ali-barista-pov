import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCgfJDdnaQQ_FDb-E-cfeABjL9UN9HH4wE",
    authDomain: "barista-pov.firebaseapp.com",
    databaseURL: "https://barista-pov-default-rtdb.firebaseio.com",
    projectId: "barista-pov",
    storageBucket: "barista-pov.firebasestorage.app",
    messagingSenderId: "663000204703",
    appId: "1:663000204703:web:eebec17ee26058adc569aa"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get('id');
const batchId = urlParams.get('batch');
const itemsContainer = document.getElementById('r-items');

document.getElementById('finish-btn').addEventListener('click', () => {
    localStorage.removeItem('lastOrder');
    window.location.href = 'index.html';
});

async function loadReceipt() {
    const dbRef = ref(db);
    
    try {
        // Fetch once. If the barista hits 'Finish', this data remains in memory.
        const snapshot = await get(child(dbRef, 'orders'));
        
        if (snapshot.exists()) {
            const allOrders = snapshot.val();
            let myItems = [];
            
            if (orderId && allOrders[orderId]) {
                myItems = [allOrders[orderId]];
            } else if (batchId) {
                myItems = Object.values(allOrders).filter(item => item.batch_id === batchId);
            }

            if (myItems.length > 0) {
                renderReceiptData(myItems, orderId || batchId);
                return;
            }
        }
        
        // --- LOCAL STORAGE FALLBACK ---
        const saved = localStorage.getItem('lastOrder');
        if (saved) {
            const lastOrder = JSON.parse(saved);
            const fallbackItems = [{
                details: "Order Completed",
                total: "PAID",
                date: lastOrder.date,
                notes: lastOrder.notes
            }];
            renderReceiptData(fallbackItems, orderId || batchId || "ARCHIVED");
            document.getElementById('r-items').innerHTML += `<div style="color:gray; font-size:0.7rem; margin-top:10px;">* This is a saved copy of your receipt.</div>`;
        } else {
            itemsContainer.innerHTML = "No order records found.";
        }

    } catch (error) {
        console.error("Error loading receipt:", error);
        itemsContainer.innerHTML = "Error loading receipt.";
    }
}

function renderReceiptData(items, displayId) {
    itemsContainer.innerHTML = "";
    let totalSum = 0;

    items.forEach(item => {
        const row = document.createElement('div');
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.marginBottom = "4px";
        
        const priceValue = parseInt(item.total) || 0;
        totalSum += priceValue;

        row.innerHTML = `<span>${item.details}</span> <span>${item.total}</span>`;
        itemsContainer.appendChild(row);
    });

    document.getElementById('r-date').textContent = items[0].date || "N/A";
    document.getElementById('r-short-id').textContent = "#" + displayId.slice(-4);
    document.getElementById('r-full-id').textContent = displayId;
    document.getElementById('r-total').textContent = items[0].total === "PAID" ? "TOTAL: PAID" : `TOTAL: ${totalSum} 💋`;
    document.getElementById('r-notes').textContent = items[0].notes || "None";
}

loadReceipt();