import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { statsApi } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Wallet,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  Moon,
  Sun,
  LogOut,
  Package,
  ChevronRight
} from 'lucide-react';

const BossDashboard = () => {
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const response = await statsApi.getBossStats();
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const handleDriverClick = (driverId) => {
    navigate(`/boss/ledger?driver_id=${driverId}&tab=history`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingPaymentsCount = stats?.pending_payments?.length || 0;

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24" data-testid="boss-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {user?.username}</h1>
          <p className="text-muted-foreground">Boss Dashboard</p>
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

      {/* Hero Card - Net Profit */}
      <Card className="hero-gradient text-white mb-6" data-testid="net-profit-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-medium">Net Profit (Finalized)</span>
          </div>
          <p className="money-large">{formatCurrency(stats?.net_profit || 0)}</p>
          <p className="text-sm opacity-80 mt-2">
            From {stats?.completed_count || 0} completed orders
          </p>
        </CardContent>
      </Card>

      {/* Financial Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
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

        <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" data-testid="total-revenue-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Total Revenue</span>
            </div>
            <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
              {formatCurrency(stats?.total_revenue || 0)}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">
              Finalized sales
            </p>
          </CardContent>
        </Card>

        <Card data-testid="staff-payments-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Staff Payments</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(stats?.total_staff_payments || 0)}</p>
            <p className="text-xs text-muted-foreground">
              {stats?.completed_count || 0} deliveries
            </p>
          </CardContent>
        </Card>

        <Card data-testid="total-orders-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">Total Orders</span>
            </div>
            <p className="text-xl font-bold">{stats?.total_orders || 0}</p>
            <p className="text-xs text-muted-foreground">
              all time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Deposits Banner */}
      {pendingPaymentsCount > 0 && (
        <Card
          className="mb-6 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
          onClick={() => navigate('/boss/ledger?tab=deposits')}
          data-testid="pending-deposits-banner"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Pending Deposits</p>
                <p className="text-xs text-muted-foreground">{pendingPaymentsCount} awaiting approval</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400">
                {pendingPaymentsCount}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Driver Holdings */}
      <Card data-testid="driver-holdings-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Driver Holdings
            <span className="text-xs text-muted-foreground font-normal ml-auto">from completed orders</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.pending_collections?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>All collections up to date!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats?.pending_collections?.map((item) => (
                <div
                  key={item.driver_id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted/80 transition-colors group"
                  onClick={() => handleDriverClick(item.driver_id)}
                  data-testid={`collection-${item.driver_id}`}
                >
                  <div>
                    <p className="font-semibold">{item.driver_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Sales: {formatCurrency(item.total_sales)} · Earnings: {formatCurrency(item.driver_earnings)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="font-bold text-lg text-accent">
                        {formatCurrency(item.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">Holding</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BossDashboard;
