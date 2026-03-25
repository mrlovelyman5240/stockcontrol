# Mixy Logistics - Delivery Management App

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, react-router-dom, Sonner
- Backend: FastAPI, Motor (async MongoDB), PyJWT, Bcrypt
- Database: MongoDB | Architecture: REST API, JWT Auth, RBAC, PWA

## Default Boss Account
- Username: `admin` | Password: `admin123`

## User Model
- `username`: Used for login only
- `full_name`: Displayed throughout the app (orders, staff list, profiles)
- `role`: boss, customer_service, driver

## All Completed Features
- [x] Role-based Auth (Boss, CS, Driver) with conditional routing
- [x] Auto-created Boss account on fresh deployment
- [x] Username + Full Name distinction (login vs display)
- [x] Change Password (all roles via Profile/Settings)
- [x] Boss: Reset any staff member's password
- [x] Boss: Delete staff accounts with confirmation
- [x] Self-delete protection
- [x] Driver compensation settings (Hourly vs Per Delivery/Pickup)
- [x] Variant-level inventory with per-variant stock tracking
- [x] POS-style order creation with variant popover + editable price
- [x] Delivery/Pickup toggle with colored badges
- [x] Free Gift accordion product→variant picker
- [x] Staff Hours Management (Boss + CS log hours)
- [x] Finance Center: Pending Deposits + Transaction History tabs
- [x] Driver deposit workflow (submit → Boss approve/reject)
- [x] Google Maps Navigation for driver delivery orders
- [x] Driver can mark own orders as Done
- [x] Audit Log page
- [x] PWA: viewport-fit=cover, safe area insets, glassmorphism bottom nav
- [x] Mobile-optimized touch targets (48px min)
- [x] Branding: Mixy Logistics + custom logos + PWA icons

## Backlog
- [ ] PWA offline support polish
- [ ] Backend refactoring (split server.py)
