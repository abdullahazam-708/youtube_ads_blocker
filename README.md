# Aegis AI Shield (All-in-One Ad Blocker)

Aegis AI Shield is a premium, unified, multi-layered ad-blocking ecosystem designed to achieve the ultimate goal: **blocking ads across all platforms (web, YouTube, social media, apps) using a single, cohesive codebase.**

## Monorepo Architecture

```
addblocker/
├── core-engine/         # Go-based high-performance proxy and DNS filter
├── ai-pipeline/         # Python-based PyTorch/ONNX ad detection models
├── central-api/         # Node.js API server for user syncing & threat intelligence
├── dashboard/           # React/Vite dashboard for controlling settings
└── extension/           # Cross-platform browser extension (Manifest V3)
```

## Core Tech Stack
* **Proxy Core:** Go
* **AI/ML Engine:** Python (PyTorch + ONNX)
* **Central Hub:** Node.js + Express
* **Database:** SQLite (default for development) / PostgreSQL
* **Admin Interface:** React (Vite) + Vanilla CSS (Glassmorphic theme)
* **Browser Layer:** JavaScript (Chrome Manifest V3)

---

## Getting Started

### 1. Go Core Engine
```bash
cd core-engine
go run main.go
```

### 2. AI/ML Pipeline
```bash
cd ai-pipeline
pip install -r requirements.txt
python train.py
```

### 3. Central API
```bash
cd central-api
npm install
npm run dev
```

### 4. Admin Dashboard
```bash
cd dashboard
npm install
npm run dev
```
