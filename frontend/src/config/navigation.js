import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  User,
  Wallet,
  ClipboardList,
  Settings,
  Clock,
  BookOpen,
} from 'lucide-react';

export const navByRole = {
  boss: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/boss' },
    { icon: ClipboardList, label: 'Orders', path: '/boss/orders' },
    { icon: Package, label: 'Inventory', path: '/boss/inventory' },
    { icon: Clock, label: 'Staff', path: '/boss/staff' },
    { icon: BookOpen, label: 'Finance', path: '/boss/ledger' },
    { icon: Settings, label: 'Settings', path: '/boss/settings' },
  ],
  customer_service: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/service' },
    { icon: ShoppingCart, label: 'New Order', path: '/service/new-order' },
    { icon: ClipboardList, label: 'Orders', path: '/service/orders' },
    { icon: Package, label: 'Inventory', path: '/service/inventory' },
    { icon: Clock, label: 'Staff', path: '/service/staff' },
    { icon: User, label: 'Profile', path: '/service/profile' },
  ],
  driver: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/driver' },
    { icon: ClipboardList, label: 'Orders', path: '/driver/orders' },
    { icon: Wallet, label: 'Earnings', path: '/driver/earnings' },
    { icon: User, label: 'Profile', path: '/driver/profile' },
  ],
};
