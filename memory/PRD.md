# LogiFlow Pro - Delivery Management App

## Original Problem Statement
Build a full-stack delivery management app with 3 role-based access levels: Boss, Customer Service, and Driver. Advanced features include POS-style orders, variant-level inventory, staff hours logging, financial center (deposits + transaction history), driver deposit workflow, Google Maps navigation, and audit logging.

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, react-router-dom, Sonner (toasts)
- Backend: FastAPI, Motor (async MongoDB), PyJWT, Bcrypt
- Database: MongoDB
- Architecture: REST API, JWT Auth, Role-based Access Control, PWA-ready

## Roles & Features

### Boss
- Dashboard: Net Profit, Pending Revenue, Total Revenue, Staff Payments, Total Orders
- Clickable "Pending Deposits" banner → navigates to Finance Center deposits tab
- Clickable Driver Holdings → navigates to filtered transaction history per driver
- Finance Center: Two-tab page (Pending Deposits with approve/reject + Transaction History with search/filter/date range)
- Staff Hours Management: Log hours for drivers, view history with filtering
- Audit Log (tracks CS modifications)
- Order & Inventory management (with variant-level stock)
- Admin Settings: Toggle driver compensation (Hourly vs Per Package)

### Customer Service
- Create orders via POS-style compact list with variant selection + editable price
- Driver assignment (mandatory), Free Gift promo (accordion product→variant picker), Order Type (Delivery/Pickup)
- Mark Done / Cancel buttons on pending orders
- Inventory management with per-variant stock tracking
- Staff Hours Management: Log hours for drivers

### Driver
- Dashboard with earnings stats (delivery/pickup breakdown)
- My Orders tab: Mark as Done button, Google Maps Navigate button (delivery orders)
- Dynamic earnings based on Boss's delivery/pickup rates
- Pay Boss: Submit deposit amounts for approval
- Payment history with status tracking

## DB Schema
- users: {id, username, password_hash, role, created_at}
- inventory: {id, name, price, stock, variants: [{name, price, stock}], created_at, updated_at}
- orders: {id, address, notes, items: [...], total, order_type, status, driver_id, driver_name, created_by, created_by_name, created_at, updated_at, delivered_at}
- settings: {id, payment_method, hourly_rate, per_delivery_rate, per_pickup_rate, updated_at, updated_by}
- audit_logs: {id, action, entity_type, entity_id, entity_name, performed_by, performed_by_name, details, timestamp}
- payments: {id, driver_id, driver_name, amount, status, submitted_at, approved_at, approved_by}
- driver_hours: {id, driver_id, driver_name, date, hours, logged_by, created_at}

## Test Credentials
- Boss: boss / boss123
- Customer Service: service1 / service123
- Driver: driver1 / driver123, driver2 / driver123

## Completed Features
- [x] Project scaffolding (FastAPI, React, MongoDB)
- [x] Role-based Authentication & conditional routing
- [x] Removed Register tab, added Logout header button
- [x] Driver compensation settings (Hourly vs split Delivery/Pickup rates)
- [x] Pending → Done financial status workflow
- [x] All dashboards for 3 roles
- [x] Inventory management with custom variants + per-variant stock tracking
- [x] Order creation with POS-style compact list + variant selection popover + editable price
- [x] Order Type: Delivery/Pickup toggle with colored badges on all views
- [x] Cancel button (red) on pending orders, inventory restored on cancel
- [x] Free Gift: Accordion product→variant picker
- [x] Unified "Customer Notes / Instructions" field for both order types
- [x] Variant-specific stock tracking (deduction, validation, cancel restore)
- [x] Service worker (network-first strategy)
- [x] Bug Fix: React crash on 422 error (getApiErrorMessage helper)
- [x] Staff Hours Management (Boss + CS can log hours, view history)
- [x] Driver Payment/Deposit Workflow (Driver submits → Boss approves/rejects)
- [x] Google Maps Navigation (Navigate button on driver pending delivery orders)
- [x] Driver can mark own orders as Done
- [x] Finance Center: Two-tab page (Pending Deposits + Transaction History)
- [x] Dashboard simplified: stats + clickable Driver Holdings + Pending Deposits banner
- [x] Removed Delivery Proof photo upload feature
- [x] Audit Log page with activity history

## Upcoming Tasks
- [ ] Initial Boss account creation flow (deployment setup)

## Backlog (P2/P3)
- [ ] PWA polish & offline support
- [ ] Backend refactoring (split server.py into route modules)
