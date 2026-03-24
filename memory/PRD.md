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
- Admin Settings: Toggle driver compensation (Hourly vs Per Package), split Per Delivery Rate + Per Pickup Rate
- Audit Log (hidden, tracks CS modifications)
- Order & Inventory management (with variant support)

### Customer Service
- Create orders via POS-style compact list with variant selection + editable price
- Driver assignment (mandatory), Free Gift promo (manual), Order Type (Delivery/Pickup)
- Mark Done / Cancel buttons on pending orders
- Inventory management with custom variants

### Driver
- Dashboard with earnings stats (delivery/pickup breakdown)
- My Orders tab with Delivery/Pickup/Cancelled badges
- Dynamic earnings based on Boss's delivery/pickup rates

## DB Schema
- users: {id, username, password_hash, role, created_at}
- inventory: {id, name, price, stock, variants: [{name, price}], created_at, updated_at}
- orders: {id, address, notes, items: [{item_id, name, price, quantity, variant_name, is_free_gift}], total, order_type, status, driver_id, driver_name, created_by, created_by_name, created_at, updated_at}
- settings: {id, payment_method, hourly_rate, per_delivery_rate, per_pickup_rate, updated_at, updated_by}
- payments: {id, driver_id, driver_name, amount, status, submitted_at, approved_at, approved_by}
- audit_logs: {id, action, entity_type, entity_id, entity_name, performed_by, performed_by_name, details, timestamp}

## Test Credentials
- Boss: boss / boss123
- Customer Service: service1 / service123
- Driver: driver1 / driver123, driver2 / driver123

## Completed Features
- [x] Project scaffolding (FastAPI, React, MongoDB)
- [x] Role-based Authentication & conditional routing
- [x] Removed Register tab, added Logout header button
- [x] Driver compensation settings (Hourly vs split Delivery/Pickup rates)
- [x] Pending -> Done financial status workflow
- [x] All dashboards for 3 roles
- [x] Inventory management with custom variants (CRUD, add/edit/delete variant rows)
- [x] Order creation with POS-style compact list + variant selection popover + editable price
- [x] Order Type: Delivery/Pickup toggle with colored badges on all views
- [x] Cancel button (red) on pending orders, inventory restored on cancel
- [x] Free Gift dropdown (manual promo, $0.00 line item)
- [x] Unified "Customer Notes / Instructions" field for both order types
- [x] Service worker (network-first strategy)
- [x] Bug Fix: React crash on 422 error (getApiErrorMessage helper) - Mar 20, 2026
- [x] Bug Fix: Orders tab visible in CS bottom nav - Mar 20, 2026
- [x] Bug Fix: Driver dropdown working in New Order - Mar 20, 2026
- [x] Custom Variants system: Backend schema + inventory UI + POS variant dialog - Mar 24, 2026
- [x] Compact POS-style product list replacing card grid - Mar 24, 2026
- [x] Editable price on variant/product selection - Mar 24, 2026

## Upcoming Tasks (P1)
- [ ] Driver Payment Submission Workflow ("Pay Boss" form + payment history)

## Backlog (P2)
- [ ] Boss Audit Log UI enhancements
- [ ] PWA polish & offline support
- [ ] Backend refactoring (split server.py into route modules)
