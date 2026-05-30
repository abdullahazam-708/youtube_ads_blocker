// Update block count statistics in extension popup
document.addEventListener('DOMContentLoaded', () => {
    const counterElement = document.getElementById('counter');
    const aiFilterToggle = document.getElementById('ai-filter');
    const dnsTunnelToggle = document.getElementById('dns-tunnel');

    // 1. Load initial values from chrome extension storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get({ totalBlocked: 0, aiFilter: true, dnsTunnel: true }, (data) => {
            counterElement.textContent = data.totalBlocked;
            aiFilterToggle.checked = data.aiFilter;
            dnsTunnelToggle.checked = data.dnsTunnel;
        });

        // Listen for storage changes in real-time (update count as ads are intercepted)
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.totalBlocked) {
                counterElement.textContent = changes.totalBlocked.newValue;
            }
        });
    } else {
        // Fallback for visual prototyping outside Chrome context
        let mockCounter = 1248;
        counterElement.textContent = mockCounter;
        setInterval(() => {
            mockCounter += Math.floor(Math.random() * 3);
            counterElement.textContent = mockCounter;
        }, 3000);
    }

    // 2. Persist configurations when changed
    aiFilterToggle.addEventListener('change', () => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ aiFilter: aiFilterToggle.checked });
        }
    });

    dnsTunnelToggle.addEventListener('change', () => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ dnsTunnel: dnsTunnelToggle.checked });
        }
    });
});
