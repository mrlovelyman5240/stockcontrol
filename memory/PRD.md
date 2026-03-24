# LogiFlow Pro - Delivery Management App

## Original Problem Statement
Build a full-stack delivery management app with 3 role-based access levels: Boss, Customer Service, and Driver. Advanced features include POS-style orders, variant-level inventory, staff hours logging, financial center (deposits + transaction history), driver deposit workflow, Google Maps navigation, and audit logging.

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, react-router-dom, Sonner (toasts)
- Backend: FastAPI, Motor (async MongoDB), PyJWT, Bcrypt
- Database: MongoDB
- Architecture: REST API, JWT Auth, Role-based Access Control, PWA-ready

## Default Boss Account (Auto-Created on Fresh Deployment)
- **Username:** `admin`
- **Password:** `admin123`
- Change password immediately after first login via Settings → Change Password

## Roles & Features

### Boss
- Dashboard: Net Profit, Pending Revenue, Total Revenue, Staff Payments, Total Orders
- Clickable "Pending Deposits" banner → navigates to Finance Center
- Clickable Driver Holdings → navigates to filtered transaction history per driver
- Finance Center: Two-tab page (Pending Deposits with approve/reject + Transaction History with search/filter/date range)
- Staff Hours Management: Log hours for drivers, view history with filtering
- Settings: Create CS/Driver accounts, Change Password, Compensation toggle (Hourly vs Per Package)
- Audit Log (tracks CS modifications)
- Order & Inventory management (with variant-level stock)

### Customer Service
- Create orders via POS-style compact list with variant selection + editable price
- Driver assignment (mandatory), Free Gift promo, Order Type (Delivery/Pickup)
- Mark Done / Cancel buttons on pending orders
- Inventory management with per-variant stock tracking
- Staff Hours Management: Log hours for drivers

### Driver
- Dashboard with earnings stats (delivery/pickup breakdown)
- My Orders tab: Mark as Done button, Google Maps Navigate button (delivery orders)
- Dynamic earnings based on Boss's delivery/pickup rates
- Pay Boss: Submit deposit amounts for approval
- Payment history with status tracking

## All Completed Features
- [x] Role-based Authentication & conditional routing
- [x] Auto-created Boss account on fresh deployment (admin/admin123)
- [x] Change Password (all roles via Settings)
- [x] Staff creation (Boss creates CS/Driver accounts from Settings)
- [x] Driver compensation settings (Hourly vs split Delivery/Pickup rates)
- [x] Inventory management with custom variants + per-variant stock tracking
- [x] POS-style order creation with variant selection popover + editable price
- [x] Order Type: Delivery/Pickup toggle with colored badges
- [x] Free Gift: Accordion product→variant picker
- [x] Variant-specific stock tracking (deduction, validation, cancel restore)
- [x] Staff Hours Management (Boss + CS can log hours)
- [x] Finance Center: Two-tab page (Pending Deposits + Transaction History)
- [x] Driver Payment/Deposit Workflow (Driver submits → Boss approves/rejects)
- [x] Google Maps Navigation (Navigate button on driver delivery orders)
- [x] Driver can mark own orders as Done
- [x] Audit Log page
- [x] Deployment health check PASSED

## Backlog
- [ ] PWA polish & offline support
- [ ] Backend refactoring (split server.py into route modules)
