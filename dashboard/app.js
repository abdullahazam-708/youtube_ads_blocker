// Aegis AI Shield - Dashboard Controller
const API_URL = 'http://localhost:5000/api/stats';

let telemetryChart = null;
let typeChart = null;
let isOfflineMode = false;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Data Load & Telemetry Setup
    fetchDashboardData();
    
    // Refresh dashboard stats every 5 seconds to keep the live feed running
    setInterval(fetchDashboardData, 5000);
});

async function fetchDashboardData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('API server unreachable');
        const data = await response.json();
        
        // Disable offline mode banner if API comes back
        document.getElementById('api-status').textContent = 'CLOUDSYNC ACTIVE';
        document.getElementById('api-status').style.borderColor = '#00f0ff';
        document.getElementById('api-status').style.color = '#00f0ff';
        document.getElementById('api-status').style.background = 'rgba(0, 240, 255, 0.05)';
        
        isOfflineMode = false;
        renderDashboard(data);
    } catch (e) {
        if (!isOfflineMode) {
            console.log('[Aegis Dashboard] Central API offline. Entering Sandbox/Simulation Mode...');
            document.getElementById('api-status').textContent = 'SANDBOX ACTIVE';
            document.getElementById('api-status').style.borderColor = '#9d4edd';
            document.getElementById('api-status').style.color = '#9d4edd';
            document.getElementById('api-status').style.background = 'rgba(157, 78, 221, 0.05)';
            isOfflineMode = true;
            setupOfflineMock();
        }
    }
}

// 2. Render Real-Time Dashboard Elements
function renderDashboard(data) {
    // Top Level Metric Counts
    document.getElementById('metric-total').textContent = Number(data.metrics.totalBlocked).toLocaleString();
    document.getElementById('metric-devices').textContent = data.metrics.devicesConnected;

    // Render Table Feed
    const feedBody = document.getElementById('live-feed-body');
    feedBody.innerHTML = '';
    
    data.latestEvents.forEach(event => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong style="color:#f8f9fa;">${event.device_name}</strong></td>
            <td class="td-url" title="${event.url}">${event.url}</td>
            <td><span class="method-badge ${event.block_type}">${event.block_type.toUpperCase()}</span></td>
            <td style="color:#8d99ae;">${new Date(event.timestamp).toLocaleTimeString()}</td>
        `;
        feedBody.appendChild(row);
    });

    // Render Connected Device Panels
    const deviceContainer = document.getElementById('device-list-container');
    deviceContainer.innerHTML = '';
    
    data.deviceBreakdown.forEach(device => {
        const icon = device.type === 'mobile' ? '📱' : device.type === 'desktop' ? '💻' : '🔌';
        const card = document.createElement('div');
        card.className = 'device-item';
        card.innerHTML = `
            <div class="device-left">
                <span class="device-icon">${icon}</span>
                <div>
                    <span class="device-name">${device.name}</span>
                    <p class="device-meta">Status: Fully Secured</p>
                </div>
            </div>
            <div class="device-right">
                <span class="device-blocked-count">${device.count} blocked</span>
            </div>
        `;
        deviceContainer.appendChild(card);
    });

    // 3. Draw Telemetry Charts
    drawTelemetryCharts(data.recentActivity, data.typeBreakdown);
}

// 4. Chart.js Drawing Pipelines
function drawTelemetryCharts(timelineData, categoriesData) {
    // Core Line Chart
    const ctxTelemetry = document.getElementById('telemetryChart').getContext('2d');
    const times = timelineData.map(d => d.time);
    const counts = timelineData.map(d => d.count);

    if (telemetryChart) {
        telemetryChart.data.labels = times;
        telemetryChart.data.datasets[0].data = counts;
        telemetryChart.update();
    } else {
        telemetryChart = new Chart(ctxTelemetry, {
            type: 'line',
            data: {
                labels: times,
                datasets: [{
                    label: 'Threats Blocked',
                    data: counts,
                    borderColor: '#00f0ff',
                    backgroundColor: 'rgba(0, 240, 255, 0.05)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#8d99ae' } },
                    y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#8d99ae' } }
                }
            }
        });
    }

    // Core Donut Chart
    const ctxType = document.getElementById('typeChart').getContext('2d');
    const typeLabels = categoriesData.map(d => d.type.toUpperCase());
    const typeCounts = categoriesData.map(d => d.count);

    if (typeChart) {
        typeChart.data.labels = typeLabels;
        typeChart.data.datasets[0].data = typeCounts;
        typeChart.update();
    } else {
        typeChart = new Chart(ctxType, {
            type: 'doughnut',
            data: {
                labels: typeLabels,
                datasets: [{
                    data: typeCounts,
                    backgroundColor: ['#00f0ff', '#9d4edd', '#b5179e'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#8d99ae', boxWidth: 12, font: { family: 'Outfit' } }
                    }
                }
            }
        });
    }
}

// 5. Offline Mock Sandbox Simulation Engine
// Simulates live traffic scrolling, ad interception telemetry, and interactive ticks
let mockTotalBlocked = 4325;
let mockDevices = [
    { name: 'Samsung Galaxy S24', type: 'mobile', count: 1845 },
    { name: 'Office Work iMac', type: 'desktop', count: 1682 },
    { name: 'Brave Extension Layer', type: 'extension', count: 798 }
];

let mockLogFeeds = [
    { device: 'Samsung Galaxy S24', url: 'https://pixel.facebook.com/tr/129', type: 'visual', time: '13:14:15' },
    { device: 'Office Work iMac', url: 'https://ads.doubleclick.net/v2/banner', type: 'network', time: '13:13:02' },
    { device: 'Brave Extension Layer', url: 'https://google-analytics.com/collect', type: 'domain', time: '13:10:48' }
];

function setupOfflineMock() {
    // Seed initial mock stats
    document.getElementById('metric-total').textContent = Number(mockTotalBlocked).toLocaleString();
    document.getElementById('metric-devices').textContent = mockDevices.length;

    updateOfflineFeedTable();
    updateOfflineDeviceContainer();

    // Render initial charts
    const mockTimeline = [
        { time: '08:00', count: 45 }, { time: '10:00', count: 82 }, { time: '12:00', count: 124 },
        { time: '14:00', count: 164 }, { time: '16:00', count: 110 }, { time: '18:00', count: 198 }
    ];
    const mockTypes = [
        { type: 'network', count: 2014 },
        { type: 'visual', count: 1420 },
        { type: 'domain', count: 891 }
    ];
    drawTelemetryCharts(mockTimeline, mockTypes);

    // Dynamic Live Tick Generator (Adds rows and increases numbers dynamically!)
    setInterval(() => {
        if (!isOfflineMode) return;

        // Increase metric blocks
        const countAdd = Math.floor(Math.random() * 3) + 1;
        mockTotalBlocked += countAdd;
        document.getElementById('metric-total').textContent = Number(mockTotalBlocked).toLocaleString();

        // Increment a random device count
        const randDevice = mockDevices[Math.floor(Math.random() * mockDevices.length)];
        randDevice.count += countAdd;
        updateOfflineDeviceContainer();

        // Push new live traffic intercept row
        const adUrls = [
            'https://telemetry.reddit.com/events/v3',
            'https://analytics.tiktok.com/pixel/tr',
            'https://stats.g.doubleclick.net/collect',
            'https://adnxs.com/seg/click',
            'https://amazon-adsystem.com/e/ir'
        ];
        const newUrl = adUrls[Math.floor(Math.random() * adUrls.length)];
        const newType = ['network', 'visual', 'domain'][Math.floor(Math.random() * 3)];
        
        mockLogFeeds.unshift({
            device: randDevice.name,
            url: newUrl,
            type: newType,
            time: new Date().toLocaleTimeString()
        });

        // Limit feed capacity to 8 items
        if (mockLogFeeds.length > 8) mockLogFeeds.pop();
        updateOfflineFeedTable();
    }, 3000);
}

function updateOfflineFeedTable() {
    const feedBody = document.getElementById('live-feed-body');
    feedBody.innerHTML = '';
    mockLogFeeds.forEach(event => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong style="color:#f8f9fa;">${event.device}</strong></td>
            <td class="td-url" title="${event.url}">${event.url}</td>
            <td><span class="method-badge ${event.type === 'domain' ? 'network' : event.type}">${event.type.toUpperCase()}</span></td>
            <td style="color:#8d99ae;">${event.time}</td>
        `;
        feedBody.appendChild(row);
    });
}

function updateOfflineDeviceContainer() {
    const deviceContainer = document.getElementById('device-list-container');
    deviceContainer.innerHTML = '';
    mockDevices.forEach(device => {
        const icon = device.type === 'mobile' ? '📱' : '💻';
        const card = document.createElement('div');
        card.className = 'device-item';
        card.innerHTML = `
            <div class="device-left">
                <span class="device-icon">${icon}</span>
                <div>
                    <span class="device-name">${device.name}</span>
                    <p class="device-meta">Status: Secure Sandbox</p>
                </div>
            </div>
            <div class="device-right">
                <span class="device-blocked-count">${device.count} blocked</span>
            </div>
        `;
        deviceContainer.appendChild(card);
    });
}
