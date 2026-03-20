# LogiFlow Pro - Delivery Management App

## Original Problem Statement
Build a full-stack delivery management app with 3 role-based access levels: Boss, Customer Service, and Driver.

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, react-router-dom, Sonner (toasts)
- Backend: FastAPI, Motor (async MongoDB), PyJWT, Bcrypt
- Database: MongoDB
- Architecture: REST API, JWT Auth, Role-based Access Control, PWA-ready

## Roles & Features

### Boss
- Full access dashboard with financial metrics (Pending Revenue, Total Revenue, Net Profit)
- Pending Collections view per driver
- Admin Settings: Toggle driver compensation (Hourly vs Per Package rate)
- Audit Log (hidden, tracks CS modifications)
- Order management

### Customer Service
- Create orders with live inventory check (prevents out-of-stock)
- BOGO promotions support
- Driver assignment (mandatory at order creation)
- Mark orders as Done (Pending -> Completed, finalizes money)
- Order management

### Driver
- Dashboard with earnings stats
- My Orders tab
- Dynamic earnings breakdown based on Boss's payment settings
- Holding calculation (Total Sales - Earnings)
- Pay Boss submission form

## DB Schema
- users: {id, username, password_hash, role, created_at}
- inventory: {id, name, price, stock, bogo_enabled, created_at, updated_at}
- orders: {id, address, items[], total, status, driver_id, driver_name, created_by, created_by_name, created_at, updated_at, completed_at}
- settings: {id, payment_method, hourly_rate, per_package_rate, updated_at, updated_by}
- payments: {id, driver_id, driver_name, amount, status, submitted_at, approved_at, approved_by}
- driver_hours: {id, driver_id, date, hours, created_at}
- audit_logs: {id, action, entity_type, entity_id, entity_name, performed_by, performed_by_name, details, timestamp}

## Test Credentials
- Boss: boss / boss123
- Customer Service: service1 / service123
- Driver: driver1 / driver123, driver2 / driver123

## Completed Features
- [x] Project scaffolding (FastAPI, React, MongoDB)
- [x] Role-based Authentication & conditional routing
- [x] Removed Register tab, added Logout header button
- [x] Driver compensation settings (Hourly vs Per Package toggle)
- [x] Pending -> Done financial status workflow
- [x] All dashboards for 3 roles
- [x] Inventory management (CRUD + BOGO)
- [x] Order creation with driver assignment
- [x] Service worker (network-first strategy)
- [x] Bug Fix: React crash on 422 error (getApiErrorMessage helper) - Mar 20, 2026
- [x] Bug Fix: Orders tab visible in CS bottom nav - Mar 20, 2026
- [x] Bug Fix: Driver dropdown working in New Order - Mar 20, 2026
- [x] Bug Fix: Safe error handling across AuthContext, Orders, NewOrder - Mar 20, 2026

## Upcoming Tasks (P1)
- [ ] Driver Payment Submission Workflow ("Pay Boss" form + payment history)

## Backlog (P2)
- [ ] Boss Audit Log UI enhancements
- [ ] PWA polish & offline support
- [ ] General error handling hardening across remaining API calls
- [ ] Backend refactoring (split server.py into route modules)
