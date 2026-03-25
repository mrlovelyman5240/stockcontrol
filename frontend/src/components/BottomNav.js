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
          { icon: User, label: 'Profile', path: '/service/profile' },
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
      className="fixed bottom-0 left-0 right-0 bg-background/70 backdrop-blur-xl border-t border-border/50 flex justify-around items-start z-50"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
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
              "flex flex-col items-center justify-center min-w-[56px] pt-2.5 pb-1 text-[11px] font-medium gap-0.5 transition-all duration-150 active:scale-95",
              active 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
          >
            <div className={cn(
              "flex items-center justify-center w-10 h-7 rounded-full transition-colors",
              active && "bg-primary/10"
            )}>
              <Icon className={cn("h-[22px] w-[22px]", active && "stroke-[2.5px]")} />
            </div>
            <span className={cn(active && "font-semibold")}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
