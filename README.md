# NAS & Raspberry Pi Remote Control Panel

A production-quality, secure web application designed to remotely control a **Synology NAS** (via Wake-on-LAN and DSM WebAPI) and manage a **Raspberry Pi 5** host server (hardware metrics and Docker container management).

---

## Architecture Overview

```
                                  ┌─────────────────────────────┐
                                  │      Client (Browser)       │
                                  │  (Mac / Mobile / Tailscale) │
                                  └──────────────┬──────────────┘
                                                 │ HTTPS / Session Cookie
                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Raspberry Pi 5 (Host & LAN Agent)                                                      │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ NAS & Server Control Service (SvelteKit + Node.js runtime)                       │  │
│  │                                                                                  │  │
│  │  ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │  Auth & Security │  │   Dashboard UI     │  │      REST API Endpoints      │  │  │
│  │  │  (HMAC Session,  │  │  (Svelte 5,        │  │  /api/nas/*, /api/pi/*,      │  │  │
│  │  │   Rate Limiter)  │  │   Tailwind CSS)    │  │  /api/docker/*, /api/health  │  │  │
│  │  └────────┬─────────┘  └────────────────────┘  └──────────────┬───────────────┘  │  │
│  │           │                                                   │                  │  │
│  │           ▼                                                   ▼                  │  │
│  │  ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │   PiService      │  │   DockerService    │  │   NasService & WolService    │  │  │
│  │  │  (CPU, RAM, Disk,│  │  (Docker Engine API│  │  (DSM WebAPI v6 Auth/Power,  │  │  │
│  │  │   Temp, Uptime)  │  │   via unix socket) │  │   UDP Magic Packet Broadcast)│  │  │
│  │  └────────┬─────────┘  └────────┬───────────┘  └──────────────┬───────────────┘  │  │
│  └───────────┼─────────────────────┼─────────────────────────────┼──────────────────┘  │
│              │                     │                             │                     │
│              ▼                     ▼                             │                     │
│     /proc & /sys & OS     /var/run/docker.sock                   │                     │
│     (Host System Stats)   (Container Management)                 │                     │
│                                                                  │                     │
└──────────────────────────────────────────────────────────────────┼─────────────────────┘
                                                                   │
                                     ┌─────────────────────────────┴─────────────────────┐
                                     │ Local LAN / Tailscale Mesh                        │
                                     │                                                   │
                                     │  • Wake-on-LAN UDP Magic Packet (Port 9/7)        │
                                     │  • Synology DSM WebAPI HTTPS (Port 5001)          │
                                     ▼                                                   ▼
                                ┌────────────────────────────────────────────────────────┐
                                │ Synology NAS (e.g. DS923+)                             │
                                │   • DSM WebAPI (Auth, Status, Shutdown, Reboot)        │
                                └────────────────────────────────────────────────────────┘
```

---

## Features

- **Synology NAS Management**:
  - **Wake-on-LAN**: Server-side broadcast of 102-byte UDP magic packet from Raspberry Pi into local LAN.
  - **Active Boot Polling**: Automatically polls DSM API after WOL packet transmission until the NAS is verified online.
  - **DSM WebAPI Authentication**: Session token management (SID & SynoToken) with automatic re-login on expiry.
  - **Safe Power Controls**: Graceful shutdown and reboot via Synology DSM WebAPI (`SYNO.Core.System`). Destructive actions are protected with confirmation dialogs.
  - **Status Reporting**: Distinguishes `ONLINE`, `OFFLINE`, `STARTING`, `AUTH_ERROR`, `NETWORK_ERROR`, and `UNKNOWN`.
- **Raspberry Pi Host Monitoring**:
  - Real-time CPU load % and load averages (1m, 5m, 15m).
  - RAM utilization (Used / Total).
  - Root filesystem disk usage (Used / Total).
  - Hardware CPU Temperature with color-coded safety badges (<50°C cool, 50-70°C normal, >70°C warm/hot).
  - System hostname, platform, OS release, and uptime.
- **Docker Container Management**:
  - Lists all running and stopped containers on the host with status, image, and exposed port mappings.
  - Lifecycle controls: Start, Stop (with confirmation), and Restart (with confirmation).
  - Integrated Log Viewer Modal with tail selection (50/100/200/500 lines), line filtering, and copy-to-clipboard.
- **Security & Hardening**:
  - Application-level password gate with HMAC-SHA256 signed `HttpOnly`, `SameSite=Strict` session cookies.
  - Brute-force mitigation via in-memory IP rate limiter.
  - No secrets, SIDs, or passwords in client code or console logs.
  - Zero arbitrary shell execution endpoints (all operations use strictly scoped APIs).

---

## Configuration (`.env`)

Copy `.env.example` to `.env` and fill in your settings:

```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Web server listening port | `3000` |
| `NODE_ENV` | Environment (`development` or `production`) | `production` |
| `APP_AUTH_SECRET` | Secret key used to sign session cookies (min 32 chars) | Random 32+ char string |
| `APP_PASSWORD` | Dashboard access password | Strong password |
| `NAS_HOST` | Synology NAS IP (LAN or Tailscale IP) | `100.x.x.x` or `192.168.1.100` |
| `NAS_PORT` | DSM WebAPI HTTPS Port | `5001` |
| `NAS_USERNAME` | DSM user account with shutdown/reboot privileges | `admin_user` |
| `NAS_PASSWORD` | DSM user account password | `admin_pass` |
| `NAS_WOL_MAC` | Physical MAC address of the Synology NAS | `00:11:32:AA:BB:CC` |
| `NAS_WOL_BROADCAST_ADDRESS` | UDP broadcast destination address | `255.255.255.255` |
| `NAS_WOL_PORT` | UDP broadcast port (usually 9 or 7) | `9` |
| `NAS_REJECT_UNAUTHORIZED` | Reject self-signed TLS certificates | `false` (if using internal certs) |
| `NAS_QUICKCONNECT_ID` | Optional QuickConnect ID (e.g. `avum` -> `http://quickconnect.to/avum`) | `avum` |
| `NAS_WEB_URL` | Optional custom / direct DSM Web URL (overrides default link) | `https://192-168-1-205.avum.direct.quickconnect.to:5001/#/signin` |
| `DOCKER_SOCKET_PATH` | Path to host Docker daemon socket | `/var/run/docker.sock` |

> [!CAUTION]
> Never commit your real `.env` file to Git. It is automatically ignored in `.gitignore`.

---

## Local Mac Development Workflow

Develop and test the application on macOS before deploying to the Raspberry Pi:

### 1. Prerequisites
- Node.js 20+ installed (`node -v`)
- npm 10+ installed (`npm -v`)

### 2. Install & Run Dev Server
```bash
# Clone repository
git clone https://github.com/KubiV/server-control-tools.git
cd server-control-tools

# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Start development server with hot-reload
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Run Automated Tests
```bash
npm run test
```

### 4. Type & Svelte Checks
```bash
npm run check
```

### 5. Build for Production
```bash
npm run build
```

---

## Production Deployment on Raspberry Pi 5

The application is containerized using a multi-stage Docker build optimized for **ARM64** (Raspberry Pi 5) and **AMD64**.

### Step 1: Clone Repository on Raspberry Pi
```bash
git clone https://github.com/KubiV/server-control-tools.git ~/server-control-tools
cd ~/server-control-tools
```

### Step 2: Configure Environment
```bash
cp .env.example .env
nano .env
```
Fill in `APP_PASSWORD`, `APP_AUTH_SECRET`, `NAS_HOST`, `NAS_USERNAME`, `NAS_PASSWORD`, and `NAS_WOL_MAC`.

### Step 3: Launch with Docker Compose
```bash
docker compose up -d --build
```

The container starts with `restart: unless-stopped` and will automatically resume on system reboots.

---

## Synchronization & Updates (`deploy.sh`)

To deploy updates from your Mac to the Raspberry Pi:

1. **On your Mac**:
   ```bash
   git commit -am "Update feature"
   git push origin main
   ```

2. **On your Raspberry Pi**:
   Run the provided deployment script:
   ```bash
   ./deploy.sh
   ```

The script will:
1. Pull the latest commits from Git (`git pull`).
2. Rebuild the container in the background.
3. Clean up dangling images (`docker image prune -f`).
4. Validate service health via `http://localhost:3000/api/health`.

---

## Security Considerations

### 1. Docker Socket Access (`/var/run/docker.sock`)
Mounting `/var/run/docker.sock` grants access to the Docker Engine API.
- **Protection**: The application provides strictly scoped endpoints (`list`, `start`, `stop`, `restart`, `logs`). It does **not** expose arbitrary command execution (`docker exec`) or arbitrary container creation.
- Keep the dashboard password strong and secure.

### 2. Synology DSM WebAPI Credentials
- Credentials reside exclusively on the server side (`src/lib/server/nas/NasService.ts`).
- SIDs, session cookies, and passwords are automatically scrubbed from client responses and application logs.

### 3. Rate Limiting
- The authentication endpoint enforces in-memory rate limiting (max 5 failed attempts per 5 minutes per IP address) to prevent brute-force attacks.

---

## Tailscale & Cloudflare Considerations

### Tailscale
- When both Raspberry Pi and Synology NAS are connected to Tailscale, set `NAS_HOST` to the NAS Tailscale IP (e.g. `100.x.x.x`).
- Wake-on-LAN is a **Layer 2 LAN broadcast protocol**: the WOL packet cannot traverse routed Tailscale tunnels directly. Because the Raspberry Pi is physically connected to the same LAN as the Synology NAS, the Raspberry Pi broadcasts the magic packet locally over Ethernet/Wi-Fi to wake the NAS.

### Cloudflare Tunnels / Reverse Proxy
If exposing the Raspberry Pi dashboard via Cloudflare Tunnels:
1. Point your tunnel to `http://localhost:3000`.
2. All traffic will be encrypted via Cloudflare HTTPS.
3. The dashboard's HMAC session cookie and authentication layer will protect the dashboard at the application level.

---

## Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Wake-on-LAN does not wake NAS** | WOL disabled in DSM or broadcast blocked by Docker bridge network | 1. Enable WOL in DSM: **Control Panel > Hardware & Power > General > Enable Wake on LAN for LAN 1/2**.<br>2. In `docker-compose.yml`, uncomment `network_mode: host` so the container sends Layer 2 broadcasts directly. |
| **NAS Status shows `AUTH_ERROR` (2FA required)** | Account has 2-Step Verification enabled | Use a dedicated DSM service account or app credential that does not enforce interactive 2FA OTP codes. |
| **NAS Status shows `NETWORK_ERROR` (Self-signed cert)** | DSM uses self-signed HTTPS certificate | Set `NAS_REJECT_UNAUTHORIZED=false` in `.env`. |
| **Docker containers not visible** | Socket permissions or daemon offline | Ensure `/var/run/docker.sock` is mounted and the Docker daemon is active (`sudo systemctl status docker`). |
| **CPU Temperature shows `N/A` on Mac** | Hardware sensor `/sys/class/thermal` is Linux-specific | Normal behavior during local Mac development. Temperature works automatically when deployed on Raspberry Pi. |
