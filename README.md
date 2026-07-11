# ANFA WhatsApp Platform

An open-source, local-first CRM built for absolute data sovereignty. This platform allows you to manage WhatsApp communications directly on your own infrastructure without routing data through third-party cloud services.

## Tech Stack
- **Backend**: FastAPI (Python 3.11+, fully async)
- **Task Queue**: ARQ (Redis-backed async workers)
- **Database**: PostgreSQL 16 (with native range partitioning)
- **Cache/Broker**: Redis 7
- **Frontend**: Next.js 14+ (App Router, Tailwind CSS)
- **Ingress**: Nginx (HTTP/2, SSE optimized)

## Architecture Overview
The platform enforces a strict "Local-First" architecture. 
- **Modularity**: Backend, frontend, and background workers operate independently.
- **Security**: Features HMAC-SHA256 signature verification for webhooks, constant-time comparisons, and strict network isolation (databases are not exposed outside the internal Docker network).
- **Data Sovereignty**: Your data never leaves your environment.

## How to Start

### Prerequisites
- Docker Engine 24.0+
- Docker Compose v2.20+
- Minimal 4GB RAM

### Quick Start
1. **Clone the repository:**
   ```bash
   git clone https://github.com/anfa-tech/anfa-whatsapp-platform.git
   cd anfa-whatsapp-platform
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Meta App credentials and database secrets
   ```

3. **Launch the Stack:**
   ```bash
   docker compose up -d
   ```

4. **Verify Deployment:**
   ```bash
   docker compose ps
   ```

Access the UI at `http://localhost:3000` (or `http://localhost` if using Nginx reverse proxy).

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See the `LICENSE` file for details. This ensures the project remains open-source and free, while enforcing that any derivative works also remain open-source.
