# LogiFlow Pro - Delivery Management App

## Original Problem Statement
Build a full-stack delivery management app with 3 role-based access levels: Boss, Customer Service, and Driver. Advanced features include POS-style orders, variant-level inventory, staff hours logging, financial ledger, driver deposit workflow, Google Maps navigation, delivery proof photo upload, and audit logging.

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, react-router-dom, Sonner (toasts)
- Backend: FastAPI, Motor (async MongoDB), PyJWT, Bcrypt, Requests
- Database: MongoDB
- Storage: Emergent Object Storage (delivery proof photos)
- Architecture: REST API, JWT Auth, Role-based Access Control, PWA-ready

## Roles & Features

### Boss
- Full access dashboard with financial metrics (Pending Revenue, Total Revenue, Net Profit)
- Pending Collections view per driver
- Payment approval/rejection queue
- Admin Settings: Toggle driver compensation (Hourly vs Per Package), split Per Delivery Rate + Per Pickup Rate
- Staff Hours Management: Log hours for drivers, view history with filtering
- Financial Ledger: Full transaction history with type/driver/date filters
- Audit Log (tracks CS modifications)
- Order & Inventory management (with variant-level stock)
- View delivery proof photos on orders

### Customer Service
- Create orders via POS-style compact list with variant selection + editable price
- Driver assignment (mandatory), Free Gift promo (accordion product->variant picker), Order Type (Delivery/Pickup)
- Mark Done / Cancel buttons on pending orders
- Inventory management with per-variant stock tracking
- Staff Hours Management: Log hours for drivers
- View delivery proof photos on orders

### Driver
- Dashboard with earnings stats (delivery/pickup breakdown)
- My Orders tab with Delivery/Pickup/Cancelled badges
- Google Maps "Navigate" button for delivery orders
- Upload delivery proof photo for completed orders
- Dynamic earnings based on Boss's delivery/pickup rates
- Pay Boss: Submit deposit amounts for approval
- Payment history with status tracking

## DB Schema
- users: {id, username, password_hash, role, created_at}
- inventory: {id, name, price, stock, variants: [{name, price, stock}], created_at, updated_at}
- orders: {id, address, notes, items: [...], total, order_type, status, driver_id, driver_name, proof_photo_id, proof_photo_path, created_by, created_by_name, created_at, updated_at, delivered_at}
- settings: {id, payment_method, hourly_rate, per_delivery_rate, per_pickup_rate, updated_at, updated_by}
- audit_logs: {id, action, entity_type, entity_id, entity_name, performed_by, performed_by_name, details, timestamp}
- payments: {id, driver_id, driver_name, amount, status, submitted_at, approved_at, approved_by}
- driver_hours: {id, driver_id, driver_name, date, hours, logged_by, created_at}
- delivery_photos: {id, order_id, storage_path, original_filename, content_type, size, uploaded_by, uploaded_by_name, created_at}

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
- [x] Inventory management with custom variants + per-variant stock tracking
- [x] Order creation with POS-style compact list + variant selection popover + editable price
- [x] Order Type: Delivery/Pickup toggle with colored badges on all views
- [x] Cancel button (red) on pending orders, inventory restored on cancel
- [x] Free Gift: Accordion product->variant picker (search -> expand product -> select variant)
- [x] Unified "Customer Notes / Instructions" field for both order types
- [x] Variant-specific stock tracking (deduction, validation, cancel restore)
- [x] Service worker (network-first strategy)
- [x] Bug Fix: React crash on 422 error (getApiErrorMessage helper)
- [x] Staff Hours Management (Boss + CS can log hours, view history with filtering)
- [x] Financial Ledger (Boss-only, with type/driver/date/search filters)
- [x] Driver Payment/Deposit Workflow (Driver submits -> Boss approves/rejects)
- [x] Google Maps Navigation (Navigate button on driver pending delivery orders)
- [x] Delivery Proof Photo Upload (Driver uploads for completed orders, Boss/CS can view)
- [x] Audit Log page with activity history
- [x] Object Storage integration for photo uploads

## Upcoming Tasks (P1)
- [ ] Initial Boss account creation flow (deployment setup)

## Backlog (P2)
- [ ] PWA polish & offline support
- [ ] Backend refactoring (split server.py into route modules)
