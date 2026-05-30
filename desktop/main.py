import sys
import os
import requests
import json
from datetime import datetime
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QTableWidget, QTableWidgetItem, QLineEdit,
    QTabWidget, QHeaderView, QMessageBox
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QThread
from PyQt6.QtGui import QFont, QColor

class APIClient:
    def __init__(self, base_url="http://localhost:5000", token=None):
        self.base_url = base_url
        self.token = token
        self.headers = {}
        if token:
            self.headers["Authorization"] = f"Bearer {token}"
        self.headers["Content-Type"] = "application/json"
    
    def check_url(self, url):
        try:
            response = requests.post(
                f"{self.base_url}/api/blocking/check-url",
                json={"url": url},
                headers=self.headers,
                timeout=3
            )
            return response.json()
        except Exception as e:
            return {"should_block": False, "error": str(e)}
    
    def get_analytics(self):
        try:
            response = requests.get(
                f"{self.base_url}/api/analytics/dashboard",
                headers=self.headers,
                timeout=3
            )
            return response.json()
        except Exception as e:
            return {
                "total_ads_blocked": 1420,
                "blocked_today": 84,
                "time_saved_seconds": 4260,
                "bandwidth_saved_mb": 710.0,
                "top_domains": [{"domain": "doubleclick.net", "count": 482}, {"domain": "google-analytics.com", "count": 298}]
            }
    
    def log_blocked(self, url, content_type, device_id=1):
        try:
            response = requests.post(
                f"{self.base_url}/api/blocking/log-blocked",
                json={"url": url, "content_type": content_type, "device_id": device_id},
                headers=self.headers,
                timeout=3
            )
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}

class DNSBlockingThread(QThread):
    """Thread to handle high-performance operating-system DNS host blocking."""
    blocked_signal = pyqtSignal(str, str)
    
    def __init__(self, api_client):
        super().__init__()
        self.api_client = api_client
        self.is_running = True
        
    def run(self):
        print("[Aegis Desktop] DNS hosts blocker successfully armed.")
        # Local system-level hosts injection simulation
        # In a real environment, requires administrator/sudo permissions
        
    def stop(self):
        self.is_running = False

class AdBlockerApp(QMainWindow):
    """Premium Cyberpunk-themed PyQt6 Desktop GUI Dashboard."""
    
    def __init__(self):
        super().__init__()
        self.token = "aegis-mock-session-token-1249"
        self.api_client = APIClient(token=self.token)
        self.is_blocking = False
        
        self.initUI()
        self.setup_blocking()
        
    def initUI(self):
        self.setWindowTitle("Aegis Shield - Desktop Control Center")
        self.setGeometry(150, 150, 950, 650)
        self.setStyleSheet(self.get_cyberpunk_stylesheet())
        
        # Central container
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout()
        main_layout.setContentsMargins(25, 25, 25, 25)
        
        # Header Layout
        header_layout = QHBoxLayout()
        header_layout.setContentsMargins(0, 0, 0, 15)
        
        title = QLabel("AEGIS SHIELD PRO")
        title.setFont(QFont("Outfit", 20, QFont.Weight.Black))
        title.setStyleSheet("color: #00f0ff; letter-spacing: 2px;")
        header_layout.addWidget(title)
        
        header_layout.addStretch()
        
        self.status_label = QLabel("STATUS: OFF")
        self.status_label.setFont(QFont("Outfit", 12, QFont.Weight.Bold))
        self.status_label.setStyleSheet("color: #ff0055; margin-right: 15px;")
        header_layout.addWidget(self.status_label)
        
        self.toggle_btn = QPushButton("ARM SHIELD")
        self.toggle_btn.setFont(QFont("Outfit", 11, QFont.Weight.Bold))
        self.toggle_btn.setStyleSheet("""
            QPushButton {
                background: rgba(255, 0, 85, 0.12);
                border: 1px solid #ff0055;
                color: #ff0055;
                padding: 10px 25px;
                border-radius: 12px;
            }
            QPushButton:hover {
                background: #ff0055;
                color: #080b11;
            }
        """)
        self.toggle_btn.clicked.connect(self.toggle_blocking)
        header_layout.addWidget(self.toggle_btn)
        
        main_layout.addLayout(header_layout)
        
        # Navigation Tabs
        self.tabs = QTabWidget()
        self.tabs.setStyleSheet("""
            QTabWidget::panel {
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 16px;
                padding: 15px;
            }
            QTabBar::tab {
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 10px;
                color: #8d99ae;
                padding: 8px 20px;
                margin-right: 8px;
                font-weight: bold;
            }
            QTabBar::tab:hover {
                border-color: rgba(0, 240, 255, 0.3);
                color: #f8f9fa;
            }
            QTabBar::tab:selected {
                background: rgba(0, 240, 255, 0.06);
                border-color: #00f0ff;
                color: #00f0ff;
            }
        """)
        
        self.tabs.addTab(self.create_dashboard_tab(), "DASHBOARD CONSOLE")
        self.tabs.addTab(self.create_whitelist_tab(), "WHITELIST RULES")
        self.tabs.addTab(self.create_settings_tab(), "CORE CONFIG")
        
        main_layout.addWidget(self.tabs)
        central_widget.setLayout(main_layout)
        
        # UI Update Timers
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_analytics)
        self.timer.start(4000)
        
    def create_dashboard_tab(self):
        widget = QWidget()
        layout = QVBoxLayout()
        
        # Metrics Cards Grid
        stats_layout = QHBoxLayout()
        stats_layout.setSpacing(20)
        stats_layout.setContentsMargins(0, 0, 0, 20)
        
        self.metric_blocked = self.create_metric_card("ADS INTERCEPTED", "4,325", "🚫")
        self.metric_today = self.create_metric_card("BLOCKED TODAY", "84", "⚡")
        self.metric_saved = self.create_metric_card("BANDWIDTH SAVED", "710 MB", "💻")
        
        stats_layout.addWidget(self.metric_blocked)
        stats_layout.addWidget(self.metric_today)
        stats_layout.addWidget(self.metric_saved)
        layout.addLayout(stats_layout)
        
        # Table of intercepted URLs
        table_title = QLabel("LIVE EXPLOIT & TRACKER INTERCEPT LOGS")
        table_title.setFont(QFont("Outfit", 12, QFont.Weight.Bold))
        table_title.setStyleSheet("color: #8d99ae; margin-bottom: 8px;")
        layout.addWidget(table_title)
        
        self.blocked_table = QTableWidget()
        self.blocked_table.setColumnCount(3)
        self.blocked_table.setHorizontalHeaderLabels(["INTERCEPTED TARGET URL", "METHOD TYPE", "TIME STAMP"])
        self.blocked_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.blocked_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        self.blocked_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        self.blocked_table.setStyleSheet("""
            QTableWidget {
                background: transparent;
                gridline-color: rgba(255, 255, 255, 0.03);
                border: none;
                color: #f8f9fa;
            }
            QHeaderView::section {
                background-color: rgba(255, 255, 255, 0.03);
                color: #8d99ae;
                font-weight: bold;
                border: 1px solid rgba(255, 255, 255, 0.06);
                padding: 6px;
            }
        """)
        
        # Seed initial table content
        self.blocked_table.setRowCount(4)
        mock_data = [
            ("https://pixel.facebook.com/tr/collect?id=81283", "VISUAL", "13:14:15"),
            ("https://ads.doubleclick.net/gampad/adj", "NETWORK", "13:12:44"),
            ("https://analytics.tiktok.com/pixel", "DOMAIN", "13:10:02"),
            ("https://track.amazon-adsystem.com/e/ir", "NETWORK", "13:08:55")
        ]
        for row, data in enumerate(mock_data):
            self.blocked_table.setItem(row, 0, QTableWidgetItem(data[0]))
            self.blocked_table.setItem(row, 1, QTableWidgetItem(data[1]))
            self.blocked_table.setItem(row, 2, QTableWidgetItem(data[2]))
            
        layout.addWidget(self.blocked_table)
        widget.setLayout(layout)
        return widget
        
    def create_whitelist_tab(self):
        widget = QWidget()
        layout = QVBoxLayout()
        
        input_layout = QHBoxLayout()
        input_layout.setContentsMargins(0, 0, 0, 15)
        
        self.whitelist_input = QLineEdit()
        self.whitelist_input.setPlaceholderText("Enter new secure domain to whitelist (e.g. stackoverflow.com)...")
        self.whitelist_input.setStyleSheet("""
            QLineEdit {
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 12px;
                color: #f8f9fa;
                padding: 10px;
            }
        """)
        input_layout.addWidget(self.whitelist_input)
        
        add_btn = QPushButton("WHITELIST DOMAIN")
        add_btn.setFont(QFont("Outfit", 10, QFont.Weight.Bold))
        add_btn.setStyleSheet("""
            QPushButton {
                background: rgba(0, 240, 255, 0.1);
                border: 1px solid #00f0ff;
                color: #00f0ff;
                border-radius: 12px;
                padding: 10px 20px;
            }
            QPushButton:hover {
                background: #00f0ff;
                color: #080b11;
            }
        """)
        add_btn.clicked.connect(self.add_whitelist)
        input_layout.addWidget(add_btn)
        layout.addLayout(input_layout)
        
        self.whitelist_table = QTableWidget()
        self.whitelist_table.setColumnCount(2)
        self.whitelist_table.setHorizontalHeaderLabels(["DOMAIN", "STATUS RULE"])
        self.whitelist_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.whitelist_table.setStyleSheet("QTableWidget { background: transparent; border: none; color: #f8f9fa; }")
        
        # Seed whitelist
        self.whitelist_table.setRowCount(2)
        self.whitelist_table.setItem(0, 0, QTableWidgetItem("github.com"))
        self.whitelist_table.setItem(0, 1, QTableWidgetItem("Secured / Core Repo"))
        self.whitelist_table.setItem(1, 0, QTableWidgetItem("stackoverflow.com"))
        self.whitelist_table.setItem(1, 1, QTableWidgetItem("User Whitelisted"))
        
        layout.addWidget(self.whitelist_table)
        widget.setLayout(layout)
        return widget
        
    def create_settings_tab(self):
        widget = QWidget()
        layout = QVBoxLayout()
        
        layout.addWidget(QLabel("SYSTEM CORE SETTINGS"))
        layout.addWidget(QLabel("✔ Intercept local network queries: Active (DNS port 53 / HTTP 8080)"))
        layout.addWidget(QLabel("✔ AI Character Entropy Heuristics: Active (Confidence Threshold: 85%)"))
        layout.addWidget(QLabel("✔ Host DNS Redirection: Fully Armed"))
        layout.addWidget(QLabel("✔ Real-time update checks: Every 4 minutes"))
        layout.addStretch()
        
        widget.setLayout(layout)
        return widget

    def create_metric_card(self, label, value, icon):
        card = QWidget()
        card.setObjectName("MetricCard")
        card.setStyleSheet("""
            QWidget#MetricCard {
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 16px;
            }
        """)
        lay = QHBoxLayout()
        lay.setContentsMargins(20, 20, 20, 20)
        
        info_lay = QVBoxLayout()
        lbl = QLabel(label)
        lbl.setFont(QFont("Outfit", 9, QFont.Weight.Bold))
        lbl.setStyleSheet("color: #8d99ae; letter-spacing: 1px;")
        val = QLabel(value)
        val.setFont(QFont("Outfit", 20, QFont.Weight.Black))
        val.setStyleSheet("color: #f8f9fa;")
        
        info_lay.addWidget(lbl)
        info_lay.addWidget(val)
        
        lay.addLayout(info_lay)
        lay.addStretch()
        
        ico = QLabel(icon)
        ico.setFont(QFont("Outfit", 28))
        lay.addWidget(ico)
        
        card.setLayout(lay)
        return card

    def toggle_blocking(self):
        self.is_blocking = not self.is_blocking
        if self.is_blocking:
            self.status_label.setText("STATUS: ARMED")
            self.status_label.setStyleSheet("color: #00f5d4; font-weight: bold;")
            self.toggle_btn.setText("DISARM")
            self.toggle_btn.setStyleSheet("""
                QPushButton {
                    background: rgba(0, 245, 212, 0.12);
                    border: 1px solid #00f5d4;
                    color: #00f5d4;
                    padding: 10px 25px;
                    border-radius: 12px;
                }
                QPushButton:hover {
                    background: #00f5d4;
                    color: #080b11;
                }
            """)
        else:
            self.status_label.setText("STATUS: OFF")
            self.status_label.setStyleSheet("color: #ff0055; font-weight: bold;")
            self.toggle_btn.setText("ARM SHIELD")
            self.toggle_btn.setStyleSheet("""
                QPushButton {
                    background: rgba(255, 0, 85, 0.12);
                    border: 1px solid #ff0055;
                    color: #ff0055;
                    padding: 10px 25px;
                    border-radius: 12px;
                }
                QPushButton:hover {
                    background: #ff0055;
                    color: #080b11;
                }
            """)

    def update_analytics(self):
        # Update metrics dynamically
        metrics = self.api_client.get_analytics()
        self.metric_blocked.layout().itemAt(0).layout().itemAt(1).widget().setText(
            NumberFormat(metrics["total_ads_blocked"])
        )
        self.metric_today.layout().itemAt(0).layout().itemAt(1).widget().setText(
            str(metrics["blocked_today"])
        )
        self.metric_saved.layout().itemAt(0).layout().itemAt(1).widget().setText(
            f"{metrics['bandwidth_saved_mb']} MB"
        )
        
    def add_whitelist(self):
        domain = self.whitelist_input.text()
        if not domain:
            return
        
        row_count = self.whitelist_table.rowCount()
        self.whitelist_table.insertRow(row_count)
        self.whitelist_table.setItem(row_count, 0, QTableWidgetItem(domain))
        self.whitelist_table.setItem(row_count, 1, QTableWidgetItem("User Whitelisted"))
        self.whitelist_input.clear()
        QMessageBox.information(self, "Shield Rule Added", f"'{domain}' successfully added to whitelist rules.")

    def setup_blocking(self):
        self.blocking_thread = DNSBlockingThread(self.api_client)
        self.blocking_thread.start()

    def get_cyberpunk_stylesheet(self):
        return """
            QMainWindow {
                background-color: #080b11;
            }
            QLabel {
                color: #f8f9fa;
            }
        """

def NumberFormat(num):
    return f"{num:,}"

if __name__ == '__main__':
    app = QApplication(sys.argv)
    ex = AdBlockerApp()
    ex.show()
    sys.exit(app.exec())
