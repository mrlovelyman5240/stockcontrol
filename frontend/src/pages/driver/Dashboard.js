import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { statsApi } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  DollarSign, 
  Clock,
  CheckCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  Moon,
  Sun,
  LogOut,
  Wallet
} from 'lucide-react';

const DriverDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await statsApi.getDriverStats();
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto" data-testid="driver-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {user?.username}</h1>
          <p className="text-muted-foreground">Driver Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="theme-toggle">
            {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchStats} data-testid="refresh-stats">
            <RefreshCw className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} className="text-destructive hover:text-destructive" data-testid="logout-btn">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Hero Card - Finalized Earnings */}
      <Card className="hero-gradient text-white mb-6" data-testid="earnings-hero">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-medium">My Earnings (Finalized)</span>
          </div>
          <p className="money-large">{formatCurrency(stats?.earnings || 0)}</p>
          <p className="text-sm opacity-80 mt-2">
            {stats?.payment_method === 'hourly' 
              ? `${stats?.hours_logged || 0} hours × ${formatCurrency(stats?.hourly_rate || 0)}/hr`
              : `${stats?.packages_delivered || 0} deliveries × ${formatCurrency(stats?.per_package_rate || 0)}/pkg`
            }
          </p>
        </CardContent>
      </Card>

      {/* Pending vs Finalized Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Pending Revenue (Expected) */}
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" data-testid="pending-revenue-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Pending Revenue</span>
            </div>
            <p className="text-xl font-bold text-amber-800 dark:text-amber-300">
              {formatCurrency(stats?.pending_revenue || 0)}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {stats?.pending_count || 0} orders out
            </p>
          </CardContent>
        </Card>

        {/* Finalized Sales */}
        <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" data-testid="total-sales-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Total Sales</span>
            </div>
            <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
              {formatCurrency(stats?.total_sales || 0)}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">
              Finalized
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Stats */}
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">TODAY</h3>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card 
          className="card-hover cursor-pointer" 
          onClick={() => navigate('/driver/orders')}
          data-testid="today-orders-card"
        >
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{stats?.today_orders || 0}</p>
            <p className="text-xs text-muted-foreground">Orders</p>
          </CardContent>
        </Card>

        <Card data-testid="today-pending-card">
          <CardContent className="p-3 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold text-amber-600">{stats?.today_pending || 0}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>

        <Card data-testid="today-completed-card">
          <CardContent className="p-3 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
            <p className="text-2xl font-bold text-emerald-600">{stats?.today_completed || 0}</p>
            <p className="text-xs text-muted-foreground">Done</p>
          </CardContent>
        </Card>
      </div>

      {/* Holding & Payment Stats */}
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">BALANCE</h3>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card data-testid="holding-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-medium">TO BOSS / HOLDING</span>
            </div>
            <p className="text-xl font-bold text-accent">{formatCurrency(stats?.pending_to_boss || 0)}</p>
            <p className="text-xs text-muted-foreground">From completed orders</p>
          </CardContent>
        </Card>

        <Card data-testid="total-paid-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Total Paid</span>
            </div>
            <p className="text-xl font-bold text-primary">{formatCurrency(stats?.total_paid || 0)}</p>
            <p className="text-xs text-muted-foreground">Approved payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">QUICK ACTIONS</h3>
      <div className="space-y-2">
        <Button 
          variant="outline" 
          className="w-full justify-start h-12"
          onClick={() => navigate('/driver/orders')}
          data-testid="quick-orders"
        >
          <Package className="h-5 w-5 mr-3" />
          View My Orders
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start h-12"
          onClick={() => navigate('/driver/earnings')}
          data-testid="quick-earnings"
        >
          <DollarSign className="h-5 w-5 mr-3" />
          Earnings & Payments
        </Button>
      </div>
    </div>
  );
};

export default DriverDashboard;
