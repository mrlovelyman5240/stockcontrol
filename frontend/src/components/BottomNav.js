import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  User,
  Wallet,
  ClipboardList,
  Settings,
  FileText,
  Clock,
  BookOpen
} from 'lucide-react';
import { cn } from '../lib/utils';

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) return null;

  const getNavItems = () => {
    switch (user.role) {
      case 'boss':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/boss' },
          { icon: ClipboardList, label: 'Orders', path: '/boss/orders' },
          { icon: Package, label: 'Inventory', path: '/boss/inventory' },
          { icon: Clock, label: 'Staff', path: '/boss/staff' },
          { icon: BookOpen, label: 'Finance', path: '/boss/ledger' },
          { icon: Settings, label: 'Settings', path: '/boss/settings' },
        ];
      case 'customer_service':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/service' },
          { icon: ShoppingCart, label: 'New Order', path: '/service/new-order' },
          { icon: ClipboardList, label: 'Orders', path: '/service/orders' },
          { icon: Package, label: 'Inventory', path: '/service/inventory' },
          { icon: Clock, label: 'Staff', path: '/service/staff' },
        ];
      case 'driver':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/driver' },
          { icon: ClipboardList, label: 'Orders', path: '/driver/orders' },
          { icon: Wallet, label: 'Earnings', path: '/driver/earnings' },
          { icon: User, label: 'Profile', path: '/driver/profile' },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const isActive = (path) => {
    if (path === '/boss' || path === '/service' || path === '/driver') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-lg border-t border-border flex justify-around items-center z-50 safe-bottom"
      data-testid="bottom-nav"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full text-xs font-medium gap-1 transition-colors touch-action-manipulation",
              active 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
          >
            <Icon className={cn("h-5 w-5", active && "stroke-[2.5px]")} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
