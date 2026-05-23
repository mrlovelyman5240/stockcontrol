import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { navByRole } from '../config/navigation';
import { cn } from '../lib/utils';

const ROLE_ROOTS = new Set(['/boss', '/service', '/driver']);

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) return null;

  const navItems = navByRole[user.role] || [];

  const isActive = (path) => {
    if (ROLE_ROOTS.has(path)) {
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
              "relative flex flex-col items-center justify-center min-w-[56px] pt-2.5 pb-1 text-[11px] font-medium gap-0.5 transition-all duration-150 active:scale-95",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full bg-primary"
              />
            )}
            <div className={cn(
              "flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200",
              active && "bg-primary/10 scale-110"
            )}>
              <Icon className={cn("h-[22px] w-[22px] transition-transform", active && "stroke-[2.5px]")} />
            </div>
            <span className={cn(active && "font-semibold")}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
