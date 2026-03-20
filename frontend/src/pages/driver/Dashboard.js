import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { statsApi, ordersApi } from '../../lib/api';
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
  LogOut
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

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

      {/* Hero Card - Today's Earnings */}
      <Card className="hero-gradient text-white mb-6" data-testid="earnings-hero">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-medium">Today's Revenue</span>
          </div>
          <p className="money-large">{formatCurrency(stats?.today_revenue || 0)}</p>
          <p className="text-sm opacity-80 mt-2">
            {stats?.today_delivered || 0} deliveries completed today
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Today's Orders */}
        <Card 
          className="card-hover cursor-pointer" 
          onClick={() => navigate('/driver/orders')}
          data-testid="today-orders-card"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">Today's Orders</span>
            </div>
            <p className="text-3xl font-bold">{stats?.today_orders || 0}</p>
            <p className="text-xs text-muted-foreground">assigned to you</p>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card 
          className="card-hover cursor-pointer"
          onClick={() => navigate('/driver/orders')}
          data-testid="pending-orders-card"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Pending</span>
            </div>
            <p className="text-3xl font-bold text-amber-500">{stats?.today_pending || 0}</p>
            <p className="text-xs text-muted-foreground">to deliver</p>
          </CardContent>
        </Card>

        {/* Completed Today */}
        <Card data-testid="completed-today-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Completed</span>
            </div>
            <p className="text-3xl font-bold text-primary">{stats?.today_delivered || 0}</p>
            <p className="text-xs text-muted-foreground">deliveries today</p>
          </CardContent>
        </Card>

        {/* Pending to Boss */}
        <Card 
          className="card-hover cursor-pointer"
          onClick={() => navigate('/driver/earnings')}
          data-testid="pending-boss-card"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">To Boss</span>
            </div>
            <p className="text-3xl font-bold text-accent">{formatCurrency(stats?.pending_to_boss || 0)}</p>
            <p className="text-xs text-muted-foreground">pending payment</p>
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
          My Earnings & Payments
        </Button>
      </div>
    </div>
  );
};

export default DriverDashboard;
