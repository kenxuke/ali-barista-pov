import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

let lastNotifiedStatus = ""; 

if (!orderId && !batchId) {
    document.getElementById('status-text').innerText = "Order Not Found";
    document.getElementById('status-desc').innerText = "No Order ID detected.";
} else {
    document.getElementById('order-id-display').innerText = orderId ? `Order: ${orderId.slice(-4)}` : `Batch: ${batchId.slice(-4)}`;
    requestNotificationPermission();
    checkLiveOrders();
}

async function requestNotificationPermission() {
    if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            await Notification.requestPermission();
        }
    }
}

/**
 * FIX: Safe Notification Trigger
 * Decoupled from main UI logic to prevent crashes.
 */
function notifyUser(status) {
    // Only trigger logic if it's actually "Ready"
    if (status !== "Ready") {
        lastNotifiedStatus = status; // Track current non-ready status
        return;
    }

    // Trigger only on the first instance of becoming "Ready"
    if (status === "Ready" && lastNotifiedStatus !== "Ready") {
        
        try {
            // 1. Web 2 APK Native Bridge
            if (typeof JSInterface !== 'undefined') {
                JSInterface.showToast("Your coffee is ready! ☕");
                const msg = orderId ? `Order #${orderId.slice(-4)} is ready!` : "Your batch is ready!";
                JSInterface.showNotification("Cloud Nine Coffee ✨", msg);
            } 
            // 2. Web Fallback
            else if (Notification.permission === "granted") {
                new Notification("Cloud Nine Coffee ☕", {
                    body: "Your order is ready for pickup! ✨",
                    icon: "assets/logo.png"
                });
            }

            // 3. Audio Trigger
            const audio = new Audio('assets/ready-chime.mp3');
            audio.play().catch(() => console.log("Audio play deferred."));
            
        } catch (err) {
            console.error("Notification system failed:", err);
        }

        lastNotifiedStatus = "Ready";
    }
}

function checkLiveOrders() {
    const ordersRef = ref(db, 'orders');
    onValue(ordersRef, (snapshot) => {
        const allOrders = snapshot.val();
        let myItems = [];

        if (allOrders) {
            if (orderId && allOrders[orderId]) {
                myItems = [allOrders[orderId]];
            } else if (batchId) {
                myItems = Object.values(allOrders).filter(item => item.batch_id === batchId);
            }
        }

        if (myItems.length > 0) {
            processBatchStatus(myItems);
        } else {
            checkArchive();
        }
    });
}

function checkArchive() {
    const archiveRef = ref(db, 'completedOrders');
    onValue(archiveRef, (snapshot) => {
        const completedData = snapshot.val();
        let archivedItems = [];

        if (completedData) {
            if (orderId && completedData[orderId]) {
                archivedItems = [completedData[orderId]];
            } else if (batchId) {
                archivedItems = Object.values(completedData).filter(item => item.batch_id === batchId);
            }
        }

        if (archivedItems.length > 0) {
            showArchivedUI(archivedItems);
        } else {
            document.getElementById('status-text').innerText = "Order Not Found";
            document.getElementById('status-desc').innerText = "Check your link or ask the barista.";
        }
    });
}

function showArchivedUI(items) {
    const listContainer = document.getElementById('items-list');
    document.getElementById('status-text').innerText = "Order Completed";
    document.getElementById('status-desc').innerText = "Your coffee has been served! ☕";
    document.getElementById('progress-bar').style.width = "100%";
    document.getElementById('main-icon').innerText = "✨";
    
    if(document.getElementById('ready-actions')) {
        document.getElementById('ready-actions').style.display = "none";
    }

    listContainer.innerHTML = "<strong>Order Summary:</strong><br>";
    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'item-status-row';
        row.innerHTML = `<span>${item.details}</span> <strong style="color:#2e7d32;">Served</strong>`;
        listContainer.appendChild(row);
    });

    const rBtn = document.getElementById('receipt-btn');
    rBtn.style.display = "block";
    rBtn.innerText = "View Final Receipt";
    rBtn.onclick = () => {
         const target = orderId ? `id=${orderId}` : `batch=${batchId}`;
         window.location.href = `receipt.html?${target}`;
    };
}

function processBatchStatus(items) {
    const listContainer = document.getElementById('items-list');
    listContainer.innerHTML = items.length > 1 ? "<strong>Your Tray:</strong><br>" : "<strong>Order Details:</strong><br>";
    
    const weights = { "Received": 1, "Measuring": 2, "Brewing": 3, "Ready": 4 };
    let totalWeight = 0;

    items.forEach(item => {
        totalWeight += weights[item.status] || 1;
        const row = document.createElement('div');
        row.className = 'item-status-row';
        row.innerHTML = `<span>${item.details}</span> <strong>${item.status}</strong>`;
        listContainer.appendChild(row);
    });

    const avgWeight = totalWeight / items.length;
    const lowestStatusItem = items.reduce((prev, curr) => 
        (weights[prev.status] < weights[curr.status]) ? prev : curr
    );

    // Run notification logic safely
    notifyUser(lowestStatusItem.status);
    
    // Always run UI update
    updateOverallUI(lowestStatusItem.status, avgWeight);
}

function updateOverallUI(status, avgWeight) {
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('status-text');
    const desc = document.getElementById('status-desc');
    const icon = document.getElementById('main-icon');
    const receiptBtn = document.getElementById('receipt-btn');
    const readyActions = document.getElementById('ready-actions');

    text.innerText = status;
    const progressPercent = (avgWeight / 4) * 100;
    bar.style.width = `${progressPercent}%`;

    // Ensure state reset
    if (readyActions) readyActions.style.display = "none";
    icon.classList.remove('ready-bounce');

    if (status === "Ready") {
        icon.innerText = "✨";
        icon.classList.add('ready-bounce');
        desc.innerText = "Everything is ready for pickup!";
        
        // Final guard: Ensure button is visible
        receiptBtn.style.display = "block";

        receiptBtn.onclick = () => {
            const target = orderId ? `id=${orderId}` : `batch=${batchId}`;
            window.location.href = `receipt.html?${target}`;
        };
    } else {
        receiptBtn.style.display = "none";
        if (status === "Received") { icon.innerText = "📩"; desc.innerText = "Order sent to the Barista!"; }
        if (status === "Measuring") { icon.innerText = "⚖️"; desc.innerText = "Measuring out the beans..."; }
        if (status === "Brewing") { icon.innerText = "☕"; desc.innerText = "Your coffee is being brewed!"; }
    }
}
