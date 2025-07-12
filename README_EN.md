# Personal Asset Management System

> Lightweight, database-free web tool for tracking your assets, expenses and attachments. **Clone, install, run – that’s it!**

---

## Table of Contents

1. Features
2. Technology Stack
3. Project Structure
4. Quick Start
5. Deployment
6. FAQ
7. Roadmap
8. License

---

## Features

- **Asset Entry** – Record name, category, labels, amount, purchase date, channel and notes.
- **Two-Decimal Amounts** – Numbers are automatically formatted to two decimals, supports input like `99/year`.
- **Attachments** – Drag-and-drop images with in-browser preview.
- **Column Manager** – Add / hide / reorder columns, remember your preference.
- **Data Import / Export** – One-click JSON backup & restore.
- **Dark Mode & Auto-Save** – User preferences stored in `localStorage`.

---

## Technology Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | Vanilla HTML / CSS / JS, Vite | Zero framework, fast build |
| Backend  | Node.js 18 + Express | Serves static files & JSON persistence |
| Deploy   | Docker / docker-compose | Official Dockerfile provided |

---

## Project Structure

```text
suzo_management/
├─ server/            # Express backend
├─ scripts/           # Front-end ES modules
├─ styles/            # Global styles
├─ pages/             # Multi-page app
├─ data/              # Generated JSON & uploads
├─ Dockerfile         # Build image
└─ vite.config.js     # Build config
```

---

## Quick Start

```bash
# 1. Clone repository
$ git clone https://github.com/FASUZO/suzo_management.git && cd suzo_management

# 2. Install dependencies
$ npm install

# 3. Prepare env file (optional)
$ npm run setup   # copies env.example → .env

# 4. Development mode
$ npm run dev     # open http://localhost:5173

# 5. Production mode
$ npm run build   # build to dist/
$ npm start       # open http://localhost:3000
```

---

## Deployment

### Docker

```bash
# Build image
$ docker build -t asset-manager:latest .

# Run container (persist data to ./data)
$ docker run -d \
  --name asset-manager \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  asset-manager:latest
```

### Traditional Server

1. Install Node (≥14, recommended 18 LTS)  
2. Upload code  
3. `npm i && npm run build`  
4. `npm start` (use `pm2` / `systemd` for production)

---

## FAQ

| Issue | Solution |
|-------|----------|
| Port 3000 unreachable | Check firewall / process occupying the port |
| Large image upload fails | Increase `JSON_LIMIT` in `.env` and restart server |
| Need HTTPS | Put Nginx / Caddy in front as reverse proxy |

---

## Roadmap

- [ ] Mobile responsive & PWA  
- [ ] Depreciation & reports  
- [ ] Multi-user / roles  
- [ ] Remote storage (WebDAV / S3)  
- [ ] CI & automated testing

---

## License

MIT © 2023–present SUZO

---

**Version:** 250712_init_xR1
