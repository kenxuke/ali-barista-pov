import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, update, remove, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const BARISTA_PASSWORD = "1234"; 
let isHistoryView = false;
let activeOrdersData = {};
let completedOrdersData = {};
let allFeedbacksData = {};
let coffeeChart, salesChart;
let db;

// --- CUSTOM MODAL UTILS ---
const customConfirm = (title, message, isAlert = false) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const yesBtn = document.getElementById('confirm-yes-btn');
        const noBtn = document.getElementById('confirm-no-btn');
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-msg').innerText = message;
        noBtn.style.display = isAlert ? 'none' : 'inline-block';
        modal.style.display = 'flex';
        const handleResponse = (choice) => {
            modal.style.display = 'none';
            yesBtn.onclick = null;
            noBtn.onclick = null;
            resolve(choice);
        };
        yesBtn.onclick = () => handleResponse(true);
        noBtn.onclick = () => handleResponse(false);
    });
};

// --- ORDER DETAIL MODAL LOGIC ---
window.showOrderDetails = (nodeId, isFromHistory = false) => {
    const source = isFromHistory ? completedOrdersData : activeOrdersData;
    const order = source[nodeId];
    if (!order) return;

    const fullId = order.id || order.order_id || nodeId;
    
    document.getElementById('detail-id').innerText = `#${fullId.slice(-4)}`;
    document.getElementById('detail-items-list').innerText = order.details || "No items listed";
    document.getElementById('detail-notes').innerText = order.notes || "No special instructions provided.";
    document.getElementById('detail-time').innerText = isFromHistory ? (order.completedAt || 'N/A') : (order.timestamp || 'Just now');
    
    const statusEl = document.getElementById('detail-status');
    const statusText = isFromHistory ? "COMPLETED" : (order.status || "Received");
    statusEl.innerText = statusText;
    statusEl.className = `badge status-${statusText.toLowerCase()}`;

    document.getElementById('order-detail-modal').style.display = 'flex';
};

window.closeDetailModal = () => {
    document.getElementById('order-detail-modal').style.display = 'none';
};

// --- CHART INITIALIZATION ---
function initCharts() {
    const commonOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
    coffeeChart = new Chart(document.getElementById('coffeeChart'), {
        type: 'bar',
        data: { labels: [], datasets: [{ backgroundColor: '#6f4e37', data: [] }] },
        options: commonOptions
    });
    salesChart = new Chart(document.getElementById('salesChart'), {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            datasets: [
                { label: 'Sales', borderColor: '#6f4e37', data: [10, 25, 45, 30, 0], tension: 0.3 },
                { label: 'Forecast', borderColor: '#8d949e', borderDash: [5, 5], data: [15, 30, 50, 40, 60], tension: 0.3 }
            ]
        },
        options: { ...commonOptions, plugins: { legend: { display: true, position: 'bottom' } } }
    });
}

function updateCharts() {
    if (!coffeeChart || !salesChart) return;
    const typeCounts = {};
    let totalCupsSold = 0;
    Object.values(completedOrdersData).forEach(order => {
        const details = order.details || "";
        let type = "Other";
        const typeMatch = details.match(/(?:Iced|Hot)\s+(.*?)(?=\s\(|\s-|\s\d+\s💋|$)/i);
        if (typeMatch && typeMatch[1]) { type = typeMatch[1].trim(); }
        else {
            const fallbackMatch = details.match(/^(.*?)(?=\s\(|\s-|\s\d+\s💋|$)/i);
            type = fallbackMatch ? fallbackMatch[1].trim() : details.split(' ')[0];
        }
        const qtyMatch = details.match(/(\d+)\s💋/);
        const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
        typeCounts[type] = (typeCounts[type] || 0) + qty;
        totalCupsSold += qty;
    });
    coffeeChart.data.labels = Object.keys(typeCounts);
    coffeeChart.data.datasets[0].data = Object.values(typeCounts);
    coffeeChart.update();
    salesChart.data.datasets[0].data[3] = totalCupsSold; 
    salesChart.update();
}

// --- GLOBAL ACTIONS ---
window.checkLogin = async () => {
    if (document.getElementById('pass-input').value === BARISTA_PASSWORD) {
        sessionStorage.setItem('barista_auth', 'true');
        initDashboard();
    } else { 
        await customConfirm("Access Denied", "Incorrect passcode. Please try again.", true);
    }
};

window.showLogoutModal = () => document.getElementById('logout-modal').style.display = 'flex';
window.closeLogoutModal = () => document.getElementById('logout-modal').style.display = 'none';
window.confirmLogout = () => { sessionStorage.clear(); window.location.reload(); };

window.toggleView = () => {
    isHistoryView = !isHistoryView;
    const btn = document.getElementById('toggle-history-btn');
    const clearBtn = document.getElementById('clear-history-btn');
    const clearFbBtn = document.getElementById('clear-fb-btn');
    const title = document.getElementById('view-title');
    const liveAssets = document.getElementById('live-view-assets');
    const histAssets = document.getElementById('history-view-assets');
    const orderRail = document.getElementById('order-rail');

    if (isHistoryView) {
        btn.innerText = "☕ View Active";
        clearBtn.style.display = "block";
        clearFbBtn.style.display = "block";
        title.innerText = "Order History";
        liveAssets.style.display = "none";
        histAssets.style.display = "block";
        orderRail.style.display = "none";
        renderHistoryUI();
    } else {
        btn.innerText = "📜 View History";
        clearBtn.style.display = "none";
        clearFbBtn.style.display = "none";
        title.innerText = "Live Operations";
        liveAssets.style.display = "block";
        histAssets.style.display = "none";
        orderRail.style.display = "block";
        renderActiveUI();
    }
};

/** * UPDATED: updateStat
 * This triggers the status change in Firebase. 
 * When 'Ready' is passed, the customer's status.js will trigger the alert.
 */
window.updateStat = (nodeId, newStatus) => {
    update(ref(db, `orders/${nodeId}`), { 
        status: newStatus,
        statusUpdatedAt: new Date().toISOString() 
    });
};

window.archiveOrder = (nodeId) => {
    const orderData = activeOrdersData[nodeId];
    orderData.completedAt = new Date().toLocaleString();
    // Ensure final status is recorded as Ready before archiving
    orderData.status = "Ready"; 
    
    push(ref(db, 'completedOrders'), orderData).then(() => {
        remove(ref(db, `orders/${nodeId}`));
    });
};

window.deleteOrder = async (nodeId, fromHistory = false) => {
    const confirmed = await customConfirm("Delete Order", "Permanently delete this order? This cannot be undone.");
    if (confirmed) {
        const path = fromHistory ? 'completedOrders' : 'orders';
        remove(ref(db, `${path}/${nodeId}`));
    }
};

window.deleteFeedback = async (fbId) => {
    const confirmed = await customConfirm("Delete Feedback", "Remove this customer review?");
    if (confirmed) {
        remove(ref(db, `feedbacks/${fbId}`));
    }
};

window.clearAllHistory = async () => {
    const confirmed = await customConfirm("Wipe History", "WIPE ENTIRE ORDER HISTORY? This is permanent.");
    if (confirmed) remove(ref(db, 'completedOrders'));
};

window.clearFeedbackHistory = async () => {
    const confirmed = await customConfirm("Wipe Feedback", "Delete ALL feedback records?");
    if (confirmed) remove(ref(db, 'feedbacks'));
};

// --- CORE LOGIC ---
function initDashboard() {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    initCharts();
    startFirebase();
}

if (sessionStorage.getItem('barista_auth') === 'true') initDashboard();

function startFirebase() {
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
    db = getDatabase(app);

    onValue(ref(db, 'orders'), (snapshot) => {
        activeOrdersData = snapshot.val() || {};
        if (!isHistoryView) renderActiveUI();
        updateStats();
    });

    onValue(ref(db, 'completedOrders'), (snapshot) => {
        completedOrdersData = snapshot.val() || {};
        if (isHistoryView) renderHistoryUI();
        updateStats();
        updateCharts();
    });

    onValue(ref(db, 'feedbacks'), (snapshot) => {
        allFeedbacksData = snapshot.val() || {};
        renderFeedbackUI();
        updateStats();
    });
}

function updateStats() {
    const pending = Object.values(activeOrdersData).filter(o => o.status !== 'Ready').length;
    const ready = Object.values(activeOrdersData).filter(o => o.status === 'Ready').length;
    const completed = Object.keys(completedOrdersData).length;

    document.getElementById('pending-count').innerText = pending;
    document.getElementById('ready-count').innerText = ready;
    document.getElementById('completed-count').innerText = completed;

    const fbArray = Object.values(allFeedbacksData);
    const avgDisplay = document.getElementById('avg-rating');
    const starRow = document.getElementById('rating-stars');
    
    if (fbArray.length === 0) {
        avgDisplay.innerText = "0.0";
        starRow.innerText = "☆☆☆☆☆";
        return;
    }

    const totalStars = fbArray.reduce((acc, curr) => acc + parseInt(curr.rating), 0);
    const average = (totalStars / fbArray.length).toFixed(1);
    avgDisplay.innerText = average;
    const fullStars = Math.round(average);
    starRow.innerText = "★".repeat(fullStars) + "☆".repeat(5 - fullStars);
}

function renderFeedbackUI() {
    const latestContainer = document.getElementById('latest-feedback-display');
    const historyList = document.getElementById('feedback-history-rail');
    
    const feedbackArray = Object.keys(allFeedbacksData).map(id => ({
        id, ...allFeedbacksData[id]
    })).reverse();

    if (feedbackArray.length > 0) {
        const latest = feedbackArray[0];
        const displayId = latest.targetId ? latest.targetId.slice(-4) : "???";
        
        latestContainer.innerHTML = `
            <div class="latest-feedback-card">
                <div class="fb-header">
                    <strong>${"⭐".repeat(latest.rating)}</strong>
                    <small>${latest.timestamp}</small>
                </div>
                <p class="fb-comment">"${latest.comment || 'No comment'}"</p>
                <div class="fb-footer">Order: #<span class="fb-id">${displayId}</span></div>
            </div>
        `;
    } else {
        latestContainer.innerHTML = `<p style="color:#999; text-align:center;">No feedback yet.</p>`;
    }

    historyList.innerHTML = "";
    feedbackArray.forEach(fb => {
        const displayId = fb.targetId ? fb.targetId.slice(-4) : "???";
        const row = document.createElement('div');
        row.className = 'order-row';
        row.innerHTML = `
            <div class="order-id">${fb.timestamp}<br><strong>${"⭐".repeat(fb.rating)}</strong></div>
            <div class="order-info">${fb.comment || '<em>No comment</em>'}</div>
            <div style="color:var(--accent-brown); font-weight:bold;">#${displayId}</div>
            <div style="text-align:right;">
                <button class="mini-btn btn-delete" onclick="window.deleteFeedback('${fb.id}')">🗑️</button>
            </div>
        `;
        historyList.appendChild(row);
    });
}

function renderActiveUI() {
    const rail = document.getElementById('order-rail');
    rail.innerHTML = "";
    if (Object.keys(activeOrdersData).length === 0) {
        rail.innerHTML = `<div style='text-align:center; padding:40px; color:#999;'>No active orders.</div>`;
        return;
    }
    Object.keys(activeOrdersData).reverse().forEach(nodeId => {
        const order = activeOrdersData[nodeId];
        const displayId = (order.id || order.order_id || nodeId).slice(-4);
        const status = order.status || 'Received';
        
        const row = document.createElement('div');
        row.className = 'order-row';
        row.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') window.showOrderDetails(nodeId, false);
        };
        
        row.innerHTML = `
            <div class="order-id" title="${order.id || nodeId}">#${displayId}</div>
            <div class="order-info"><strong>${order.details}</strong><small>${order.notes || 'No notes'}</small></div>
            <div class="status-badge-container"><span class="badge status-${status.toLowerCase()}">${status}</span></div>
            <div class="btn-group">
                <button class="mini-btn ${status==='Measuring'?'active':''}" onclick="window.updateStat('${nodeId}','Measuring')">MSR</button>
                <button class="mini-btn ${status==='Brewing'?'active':''}" onclick="window.updateStat('${nodeId}','Brewing')">BRW</button>
                <button class="mini-btn ${status==='Ready'?'active':''}" onclick="window.updateStat('${nodeId}','Ready')">RDY</button>
                ${status === 'Ready' ? `<button class="mini-btn btn-archive" onclick="window.archiveOrder('${nodeId}')">FINISH</button>` : ''}
                <button class="mini-btn btn-delete" onclick="window.deleteOrder('${nodeId}', false)">🗑️</button>
            </div>
        `;
        rail.appendChild(row);
    });
}

function renderHistoryUI() {
    const rail = document.getElementById('order-history-rail');
    rail.innerHTML = "";
    if (Object.keys(completedOrdersData).length === 0) {
        rail.innerHTML = `<div style='text-align:center; padding:20px; color:#999;'>No archived orders.</div>`;
        return;
    }
    Object.keys(completedOrdersData).reverse().forEach(nodeId => {
        const order = completedOrdersData[nodeId];
        const fullId = order.id || order.order_id || nodeId;
        const displayId = fullId.slice(-4);
        
        const row = document.createElement('div');
        row.className = 'order-row';
        row.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') window.showOrderDetails(nodeId, true);
        };

        row.innerHTML = `
            <div class="order-id" title="${fullId}">#${displayId}</div>
            <div class="order-info"><strong>${order.details}</strong><small>Served: ${order.completedAt || 'N/A'}</small></div>
            <div class="status-badge-container"><span class="badge status-ready">DONE</span></div>
            <div style="text-align:right;"><button class="mini-btn btn-delete" onclick="window.deleteOrder('${nodeId}', true)">🗑️</button></div>
        `;
        rail.appendChild(row);
    });
}
