# Real-Time Restaurant Table Ordering System

A modern, real-time restaurant ordering system built with Next.js, Django, and WebSockets. Customers scan QR codes to instantly browse menus and place orders, while kitchen staff receive live notifications and manage orders with instant status updates across all devices.

## System Preview

### Customer View

<table>
<tr>
<td width="33%" align="center"><b>Browsing Interface</b></td>
<td width="33%" align="center"><b>Live Cart Sync for Group Ordering</b></td>
<td width="33%" align="center"><b>Realtime Order Tracking</b></td>
</tr>
<tr>
<td width="33%">(img) - Yet to upload</td>
<td width="33%">(vid) - Yet to upload</td>
<td width="33%">(vid) - Yet to upload</td>
</tr>
</table>

### Kitchen Dashboard

<table>
<tr>
<td width="50%" align="center"><b>Organised Kitchen Dashboard</b></td>
<td width="50%" align="center"><b>Live Order Update Workflow</b></td>
</tr>
<tr>
<td width="50%">(img) - Yet to upload</td>
<td width="50%">(vid) - Yet to upload</td>
</tr>
</table>

### Owner Dashboard

<table>
<tr>
<td width="33%" align="center"><b>Revenue Details</b></td>
<td width="33%" align="center"><b>Customer Insights</b></td>
<td width="33%" align="center"><b>Item Performance</b></td>
</tr>
<tr>
<td width="33%">(img) - Yet to upload</td>
<td width="33%">(img) - Yet to upload</td>
<td width="33%">(img) - Yet to upload</td>
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
