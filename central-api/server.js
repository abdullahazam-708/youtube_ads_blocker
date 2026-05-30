const express = require('express');
const cors = require('cors');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let db;

// 1. Initialize SQLite Database
async function initializeDB() {
    db = await open({
        filename: path.join(__dirname, 'aegis.db'),
        driver: sqlite3.Database
    });

    console.log('[Aegis Central API] Database connected successfully.');

    // Create Tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password TEXT
        );

        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            type TEXT, -- 'mobile' | 'desktop' | 'extension'
            user_id INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS blocked_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id INTEGER,
            url TEXT,
            block_type TEXT, -- 'network' | 'visual' | 'domain'
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(device_id) REFERENCES devices(id)
        );
    `);

    console.log('[Aegis Central API] Database schema verified.');

    // Seed Initial mock data if empty
    const usersCount = await db.get(`SELECT COUNT(*) as count FROM users`);
    if (usersCount.count === 0) {
        console.log('[Aegis Central API] Seeding database with mock data...');
        await db.run(`INSERT INTO users (email, password) VALUES ('demo@aegis.ai', 'demopass')`);
        
        await db.run(`INSERT INTO devices (name, type, user_id) VALUES ('My Android Phone', 'mobile', 1)`);
        await db.run(`INSERT INTO devices (name, type, user_id) VALUES ('Work Macbook Pro', 'desktop', 1)`);
        await db.run(`INSERT INTO devices (name, type, user_id) VALUES ('Chrome Extension', 'extension', 1)`);

        // Seed some blocked events spread over the last 24 hours
        const hour = 3600 * 1000;
        const now = Date.now();
        const urls = [
            'https://ads.doubleclick.net/pixel',
            'https://google-analytics.com/collect',
            'https://facebook.com/tr/pixel',
            'https://track.amazon-adsystem.com',
            'https://analytics.tiktok.com'
        ];

        for (let i = 0; i < 40; i++) {
            const deviceId = Math.floor(Math.random() * 3) + 1;
            const url = urls[Math.floor(Math.random() * urls.length)];
            const type = ['network', 'visual', 'domain'][Math.floor(Math.random() * 3)];
            const timeOffset = Math.floor(Math.random() * 24) * hour;
            const eventDate = new Date(now - timeOffset).toISOString();
            
            await db.run(
                `INSERT INTO blocked_events (device_id, url, block_type, timestamp) VALUES (?, ?, ?, ?)`,
                [deviceId, url, type, eventDate]
            );
        }
        console.log('[Aegis Central API] Seeding completed.');
    }
}

// 2. Endpoints
// Get global metrics and chart telemetry
app.get('/api/stats', async (req, res) => {
    try {
        const totalBlocked = await db.get(`SELECT COUNT(*) as count FROM blocked_events`);
        
        const deviceBreakdown = await db.all(`
            SELECT d.name, d.type, COUNT(b.id) as count 
            FROM devices d
            LEFT JOIN blocked_events b ON d.id = b.device_id
            GROUP BY d.id
        `);

        const typeBreakdown = await db.all(`
            SELECT block_type as type, COUNT(*) as count 
            FROM blocked_events 
            GROUP BY block_type
        `);

        // Group by hour for chart telemetry
        const recentActivity = await db.all(`
            SELECT strftime('%H:00', timestamp) as time, COUNT(*) as count
            FROM blocked_events
            WHERE timestamp >= datetime('now', '-24 hours')
            GROUP BY time
            ORDER BY timestamp ASC
        `);

        const latestEvents = await db.all(`
            SELECT b.url, b.block_type, b.timestamp, d.name as device_name
            FROM blocked_events b
            JOIN devices d ON b.device_id = d.id
            ORDER BY b.timestamp DESC
            LIMIT 8
        `);

        res.json({
            success: true,
            metrics: {
                totalBlocked: totalBlocked.count,
                devicesConnected: deviceBreakdown.length
            },
            deviceBreakdown,
            typeBreakdown,
            recentActivity,
            latestEvents
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint for clients to push new blocked ad events in real-time
app.post('/api/report-block', async (req, res) => {
    const { deviceType, url, blockType } = req.body;
    if (!deviceType || !url || !blockType) {
        return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    try {
        // Resolve or create device automatically
        let device = await db.get(`SELECT id FROM devices WHERE type = ? LIMIT 1`, [deviceType]);
        if (!device) {
            const result = await db.run(`INSERT INTO devices (name, type, user_id) VALUES (?, ?, 1)`, [
                deviceType.charAt(0).toUpperCase() + deviceType.slice(1) + ' Client',
                deviceType
            ]);
            device = { id: result.lastID };
        }

        await db.run(
            `INSERT INTO blocked_events (device_id, url, block_type) VALUES (?, ?, ?)`,
            [device.id, url, blockType]
        );

        res.json({ success: true, message: 'Block reported successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve active ML configurations and intelligence rules
app.get('/api/rules', (req, res) => {
    res.json({
        success: true,
        version: "2026.05.30.01",
        ml_models: {
            url_classifier: "/models/url_classifier.onnx",
            vision_detector: "/models/vision_detector.onnx"
        },
        static_blocklist: [
            "doubleclick.net",
            "googlesyndication.com",
            "google-analytics.com",
            "amazon-adsystem.com",
            "adnxs.com"
        ]
    });
});

// Start Server
initializeDB().then(() => {
    app.listen(PORT, () => {
        console.log(`[Aegis Central API] Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('[Aegis Central API] Initialization failed:', err);
});
