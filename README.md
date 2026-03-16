# Real-Time Restaurant Table Ordering System

A modern, real-time restaurant ordering system built with Next.js, Django, and WebSockets. Customers scan QR codes to instantly browse menus and place orders, while kitchen staff receive live notifications and manage orders with instant status updates across all devices.

## System Preview

### Customer View

<img src="./demos/1.png" alt="Browsing Interface" width="100%">

<table>
<tr>
<td width="50%" align="center"><b>Live Cart Sync for Group Ordering</b></td>
<td width="50%" align="center"><b>Realtime Order Tracking</b></td>
</tr>
<tr>
<td width="50%">(vid) - Yet to upload</td>
<td width="50%"><video width="100%" controls><source src="./demos/1.mp4" type="video/mp4"></video></td>
</tr>
</table>

### Kitchen Dashboard

<img src="./demos/2.png" alt="Organised Kitchen Dashboard" width="100%">

### Owner Dashboard

<table>
<tr>
<td width="33%" align="center"><b>Revenue Details</b></td>
<td width="33%" align="center"><b>Customer Insights</b></td>
<td width="33%" align="center"><b>Item Performance</b></td>
</tr>
<tr>
<td width="33%">
<img src="./demos/3.png" alt="Revenue Details" width="100%">
</td>
<td width="33%">
<img src="./demos/4.png" alt="Customer Insights" width="100%">
</td>
<td width="33%">
<img src="./demos/5.png" alt="Item Performance" width="100%">
</td>
</tr>
</table>

## Features

- **Real-time WebSocket synchronization** - Cart updates and order notifications appear instantly across all connected devices
- **Cross-device cart sync** - Multiple people at the same table can add items simultaneously with live updates
- **Type-safe API integration** - Auto-generated TypeScript types from OpenAPI schema ensure compile-time safety
- **Redis-backed persistence** - Cart data persists across sessions and device switches
- **JWT authentication** - Secure token-based auth with role-based access (customer/staff/owner)
- **Comprehensive analytics** - Owner dashboard with revenue trends, customer metrics, and performance insights

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **Charts**: Recharts
- **API Client**: openapi-fetch with type generation

### Backend
- **Framework**: Django 5.0
- **API**: Django Ninja (OpenAPI)
- **Real-time**: Django Channels with Redis
- **Database**: SQLite (development) / PostgreSQL (production ready)
- **Authentication**: JWT tokens
- **Cache**: Redis

---

## Key Features Detail

### Real-time Cart Synchronization
Carts are synced across devices using WebSocket connections. When a customer adds items on one device, changes appear instantly on all devices logged in with the same account.

### Order Workflow
1. Customer adds items to cart
2. Proceeds to checkout and selects payment method
3. Order is created and sent to kitchen via WebSocket
4. Kitchen staff updates status as they prepare the order
5. Customer can track status in real-time
6. Order completes when marked as delivered/completed

### Analytics
The owner dashboard provides comprehensive insights:
- Revenue tracking with historical comparisons
- Peak hours analysis for staffing decisions
- Menu performance metrics to optimize offerings
- Customer behavior patterns for retention strategies

## Getting Started

### Docker (recommended)

> Requires [Docker](https://docs.docker.com/engine/install/) with the Compose plugin.

#### Development

```bash
POPULATE_DB=true docker compose up --build
```

Open **http://localhost**.

| Option | Default | Description |
|---|---|---|
| `PORT` | `80` | Host port nginx listens on |
| `POPULATE_DB` | `false` | Seed demo menu/orders/users on startup |

**Demo credentials** (created by `populate_db`):
- **Kitchen Dashboard** — username: `kitchen`, password: `kitchen`
- **Django Admin** — create a superuser for admin access:
  ```bash
  docker compose exec backend uv run python manage.py createsuperuser
  ```

Hot-reload is enabled for both frontend (`next dev`) and backend (Daphne restarts on file change because the source directory is bind-mounted).

#### Production

```bash
SECRET_KEY=<strong-random-key> docker compose -f docker-compose.prod.yml up --build
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | **yes** | — | Django secret key |
| `PORT` | no | `80` | Host port |
| `ALLOWED_HOSTS` | no | `*` | Comma-separated allowed hostnames |
| `DATABASE_URL` | no | SQLite on a volume | e.g. `postgres://user:pass@host/db` |

The prod stack builds `next build` + a standalone Node runner, collects Django static files, and serves media directly from nginx.

---

### Local development (without Docker)

#### Backend

```bash
cd backend
uv sync
uv run python manage.py migrate
uv run python manage.py populate_db   # optional demo data
uv run daphne -b 0.0.0.0 -p 8000 conf.asgi:application
```

A local Redis instance is required for WebSocket support.

#### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

The frontend expects the backend at `http://localhost:8000` by default.
Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` to override.

#### Regenerate API types

After changing backend schemas:
```bash
cd frontend
npm run update-api-types
```