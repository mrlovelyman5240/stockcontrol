# Mixy Logistics - Delivery Management App

## Tech Stack
- Frontend: React, Tailwind CSS, shadcn/ui, react-router-dom, Sonner
- Backend: FastAPI, Motor (async MongoDB), PyJWT, Bcrypt
- Database: MongoDB | Architecture: REST API, JWT Auth, RBAC, PWA

## Default Boss Account
- Username: `admin` | Password: `admin123` | Full Name: Mıxy

## User Model
- `username`: Login only | `full_name`: Displayed throughout app | `role`: boss/customer_service/driver

## All Completed Features
- [x] Role-based Auth with conditional routing
- [x] Auto-created Boss account on fresh deployment
- [x] Username + Full Name distinction (login vs display)
- [x] Dashboard: "Welcome, [Full Name]" (no toast)
- [x] My Profile section (Boss edits own Full Name, Username, Password)
- [x] Edit User modal (pencil icon): edit Full Name, Username, Password
- [x] Reactive header update via refreshUser()
- [x] Create/Delete staff with confirmation dialog
- [x] Self-delete protection
- [x] CS/Driver: Change Password only in Profile (no user management)
- [x] Driver compensation (Hourly vs Per Delivery/Pickup)
- [x] Variant-level inventory with per-variant stock
- [x] POS-style orders with variant popover + editable price
- [x] Delivery/Pickup toggle with colored badges
- [x] Free Gift accordion picker
- [x] Staff Hours Management (Boss + CS)
- [x] Finance Center: Pending Deposits + Transaction History
- [x] Driver deposit workflow (submit → approve/reject)
- [x] Google Maps Navigation for drivers
- [x] Driver can mark own orders Done
- [x] Audit Log page
- [x] PWA: viewport-fit=cover, safe area insets, glassmorphism nav
- [x] Mobile-optimized touch targets
- [x] Branding: Mixy Logistics + custom logos + PWA icons

## Backlog
- [ ] PWA offline support polish
- [ ] Backend refactoring (split server.py)
