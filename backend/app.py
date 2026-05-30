from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import sqlite3
import hashlib
import json
from datetime import datetime, date
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# JWT Setup
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET', 'aegis-cyber-secret-key-1249')
jwt = JWTManager(app)

DB_FILE = os.path.join(os.path.dirname(__file__), '..', 'central-api', 'aegis.db')

def get_db_connection():
    """Returns a connection to our SQLite database for local portability."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize base SQLite tables if they do not exist
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            subscription_tier TEXT DEFAULT 'free',
            device_limit INTEGER DEFAULT 5,
            api_key TEXT,
            is_active BOOLEAN DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            device_name TEXT,
            device_type TEXT,
            os TEXT,
            last_sync TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS whitelist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            domain TEXT,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS blocked_content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            url TEXT,
            domain TEXT,
            content_type TEXT,
            blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reason TEXT,
            data_saved_mb REAL DEFAULT 0.5,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            device_id INTEGER,
            date DATE,
            ads_blocked INTEGER DEFAULT 0,
            bandwidth_saved_mb REAL DEFAULT 0.0,
            time_saved_seconds INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (device_id) REFERENCES devices(id)
        );
    """)
    conn.commit()
    conn.close()

init_db()

# ==================== AUTHENTICATION ====================

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not all([username, email, password]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            return jsonify({'error': 'User already exists'}), 409
        
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, subscription_tier) VALUES (?, ?, ?, ?)",
            (username, email, password_hash, 'free')
        )
        conn.commit()
        
        user_id = cursor.lastrowid
        access_token = create_access_token(identity=str(user_id))
        
        return jsonify({
            'message': 'User created successfully',
            'access_token': access_token,
            'user_id': user_id
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Missing credentials'}), 400
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id, username FROM users WHERE email = ? AND password_hash = ?",
            (email, password_hash)
        )
        user = cursor.fetchone()
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        user_id, username = user['id'], user['username']
        access_token = create_access_token(identity=str(user_id))
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user_id': user_id,
            'username': username
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ==================== DEVICE MANAGEMENT ====================

@app.route('/api/devices/register', methods=['POST'])
@jwt_required()
def register_device():
    user_id = get_jwt_identity()
    data = request.json or {}
    device_name = data.get('device_name')
    device_type = data.get('device_type')
    os_type = data.get('os')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO devices (user_id, device_name, device_type, os, last_sync) VALUES (?, ?, ?, ?, ?)",
            (user_id, device_name, device_type, os_type, datetime.now())
        )
        conn.commit()
        
        return jsonify({
            'message': 'Device registered',
            'device_id': cursor.lastrowid
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/devices', methods=['GET'])
@jwt_required()
def get_devices():
    user_id = get_jwt_identity()
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id, device_name, device_type, os, last_sync FROM devices WHERE user_id = ? AND is_active = 1",
            (user_id,)
        )
        devices = cursor.fetchall()
        
        devices_list = [
            {
                'device_id': d['id'],
                'device_name': d['device_name'],
                'device_type': d['device_type'],
                'os': d['os'],
                'last_sync': str(d['last_sync'])
            }
            for d in devices
        ]
        
        return jsonify({'devices': devices_list}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ==================== AD BLOCKING & DETECTION ====================

@app.route('/api/blocking/check-url', methods=['POST'])
@jwt_required()
def check_url():
    data = request.json or {}
    url = data.get('url')
    
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc or url
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        user_id = get_jwt_identity()
        
        # Check Whitelist
        cursor.execute(
            "SELECT id FROM whitelist WHERE user_id = ? AND domain = ?",
            (user_id, domain)
        )
        if cursor.fetchone():
            return jsonify({'should_block': False, 'reason': 'whitelisted'}), 200
        
        # Check Static Blocker
        blacklist = ['doubleclick.net', 'googlesyndication.com', 'analytics.tiktok', 'amazon-adsystem']
        for bad_domain in blacklist:
            if bad_domain in domain:
                return jsonify({
                    'should_block': True,
                    'reason': 'matches_ad_pattern',
                    'pattern_type': 'static_dns'
                }), 200
        
        # Check Heuristic Anomaly (Go-proxy matching)
        entropy_score = 0.0
        if '?' in url:
            entropy_score += 0.25
        entropy_score += url.count('&') * 0.15
        
        if entropy_score > 0.85:
            return jsonify({
                'should_block': True,
                'reason': 'ml_prediction',
                'confidence': min(entropy_score, 1.0)
            }), 200
        
        return jsonify({'should_block': False, 'reason': 'not_detected'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/blocking/log-blocked', methods=['POST'])
@jwt_required()
def log_blocked_content():
    user_id = get_jwt_identity()
    data = request.json or {}
    url = data.get('url')
    content_type = data.get('content_type', 'network')
    device_id = data.get('device_id', 1)
    
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc or url
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO blocked_content (user_id, url, domain, content_type, reason) VALUES (?, ?, ?, ?, ?)",
            (user_id, url, domain, content_type, 'heuristic_ai_intercept')
        )
        conn.commit()
        
        # Update Analytics
        today = date.today().isoformat()
        cursor.execute(
            "SELECT id FROM analytics WHERE user_id = ? AND device_id = ? AND date = ?",
            (user_id, device_id, today)
        )
        row = cursor.fetchone()
        
        if row:
            cursor.execute(
                "UPDATE analytics SET ads_blocked = ads_blocked + 1, bandwidth_saved_mb = bandwidth_saved_mb + 0.5 WHERE id = ?",
                (row['id'],)
            )
        else:
            cursor.execute(
                "INSERT INTO analytics (user_id, device_id, date, ads_blocked, bandwidth_saved_mb, time_saved_seconds) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, device_id, today, 1, 0.5, 3)
            )
        conn.commit()
        
        return jsonify({'message': 'Content logged'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ==================== ANALYTICS ====================

@app.route('/api/analytics/dashboard', methods=['GET'])
@jwt_required()
def get_analytics():
    user_id = get_jwt_identity()
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as count FROM blocked_content WHERE user_id = ?", (user_id,))
        total_blocked = cursor.fetchone()['count']
        
        today = date.today().isoformat()
        cursor.execute("SELECT SUM(ads_blocked) as count FROM analytics WHERE user_id = ? AND date = ?", (user_id, today))
        row = cursor.fetchone()
        today_blocked = row['count'] if row and row['count'] is not None else 0
        
        cursor.execute(
            "SELECT domain, COUNT(*) as count FROM blocked_content WHERE user_id = ? GROUP BY domain ORDER BY count DESC LIMIT 10",
            (user_id,)
        )
        top_domains = [{'domain': r['domain'], 'count': r['count']} for r in cursor.fetchall()]
        
        time_saved_seconds = total_blocked * 3
        
        return jsonify({
            'total_ads_blocked': total_blocked,
            'blocked_today': today_blocked,
            'top_domains': top_domains,
            'time_saved_seconds': time_saved_seconds,
            'bandwidth_saved_mb': total_blocked * 0.5
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ==================== WHITELIST MANAGEMENT ====================

@app.route('/api/whitelist/add', methods=['POST'])
@jwt_required()
def add_whitelist():
    user_id = get_jwt_identity()
    data = request.json or {}
    domain = data.get('domain')
    reason = data.get('reason', 'User whitelisted')
    
    if not domain:
        return jsonify({'error': 'Missing domain'}), 400
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO whitelist (user_id, domain, reason) VALUES (?, ?, ?)",
            (user_id, domain, reason)
        )
        conn.commit()
        
        return jsonify({'message': 'Domain whitelisted'}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/whitelist', methods=['GET'])
@jwt_required()
def get_whitelist():
    user_id = get_jwt_identity()
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, domain, reason FROM whitelist WHERE user_id = ?", (user_id,))
        rows = cursor.fetchall()
        whitelist_list = [{'id': r['id'], 'domain': r['domain'], 'reason': r['reason']} for r in rows]
        
        return jsonify({'whitelist': whitelist_list}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
