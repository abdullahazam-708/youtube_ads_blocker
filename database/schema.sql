-- ========================================================
-- AEGIS SHIELD - DATABASE SCHEMA (MySQL / SQLite Compatible)
-- ========================================================

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subscription_tier VARCHAR(50) DEFAULT 'free', -- 'free' | 'premium' | 'enterprise'
    device_limit INTEGER DEFAULT 5,
    api_key VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT 1
);

-- DEVICES TABLE
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- 'mobile' | 'desktop' | 'tablet'
    os VARCHAR(100),
    last_sync TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- AD PATTERNS TABLE (For ML training datasets)
CREATE TABLE IF NOT EXISTS ad_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type VARCHAR(100),
    regex_pattern TEXT,
    domain VARCHAR(255),
    keywords TEXT,
    confidence_score FLOAT,
    detected_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

-- BLOCKED CONTENT TABLE
CREATE TABLE IF NOT EXISTS blocked_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    url VARCHAR(1000),
    domain VARCHAR(255),
    content_type VARCHAR(100),
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(500),
    data_saved_mb FLOAT DEFAULT 0.5,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- THREAT INTELLIGENCE TABLE
CREATE TABLE IF NOT EXISTS threat_intelligence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threat_type VARCHAR(100),
    indicator VARCHAR(500),
    severity VARCHAR(50), -- 'low' | 'medium' | 'high' | 'critical'
    source VARCHAR(255),
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mitigated BOOLEAN DEFAULT 0,
    affected_users INTEGER DEFAULT 0
);

-- ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    device_id INTEGER,
    date DATE,
    ads_blocked INTEGER DEFAULT 0,
    bandwidth_saved_mb FLOAT DEFAULT 0.0,
    time_saved_seconds INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- WHITELIST TABLE
CREATE TABLE IF NOT EXISTS whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    domain VARCHAR(255),
    reason VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
