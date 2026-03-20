import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ordersApi, inventoryApi } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  Package, 
  ClipboardList,
  TrendingUp,
  Plus,
  Loader2,
  RefreshCw,
  Moon,
  Sun,
  LogOut,
  Clock,
  CheckCircle
} from 'lucide-react';

const ServiceDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [stats, setStats] = useState({ 
    orders: 0, 
    pendingOrders: 0, 
    completedOrders: 0,
    pendingRevenue: 0,
    completedRevenue: 0,
    lowStock: 0 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [ordersRes, inventoryRes] = await Promise.all([
        ordersApi.getAll(),
        inventoryApi.getAll()
      ]);
      
      const orders = ordersRes.data;
      const inventory = inventoryRes.data;
      
      const pendingOrders = orders.filter(o => o.status === 'pending');
      const completedOrders = orders.filter(o => o.status === 'completed');
      const lowStockItems = inventory.filter(i => i.stock <= 5);

      setStats({
        orders: orders.length,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        pendingRevenue: pendingOrders.reduce((sum, o) => sum + o.total, 0),
        completedRevenue: completedOrders.reduce((sum, o) => sum + o.total, 0),
        lowStock: lowStockItems.length
      });
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
    <div className="p-4 max-w-2xl mx-auto" data-testid="service-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {user?.username}</h1>
          <p className="text-muted-foreground">Customer Service</p>
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

      {/* Quick Action */}
      <Card 
        className="hero-gradient text-white mb-6 cursor-pointer card-hover"
        onClick={() => navigate('/service/new-order')}
        data-testid="new-order-card"
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-2">Create New Order</h2>
              <p className="opacity-90">Start a new delivery order</p>
            </div>
            <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center">
              <Plus className="h-8 w-8" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Stats - Pending vs Finalized */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Pending Revenue (Out on Delivery) */}
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" data-testid="pending-revenue-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Pending Revenue</span>
            </div>
            <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">
              {formatCurrency(stats.pendingRevenue)}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {stats.pendingOrders} orders out
            </p>
          </CardContent>
        </Card>

        {/* Finalized Revenue (Completed) */}
        <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" data-testid="completed-revenue-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">
              {formatCurrency(stats.completedRevenue)}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">
              {stats.completedOrders} completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Other Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="card-hover cursor-pointer" onClick={() => navigate('/service/orders')} data-testid="orders-stat">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <ClipboardList className="h-4 w-4" />
              <span className="text-xs font-medium">All Orders</span>
            </div>
            <p className="text-3xl font-bold">{stats.orders}</p>
            <p className="text-xs text-muted-foreground">total orders</p>
          </CardContent>
        </Card>

        <Card className="card-hover cursor-pointer" onClick={() => navigate('/service/inventory')} data-testid="inventory-stat">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">Low Stock</span>
            </div>
            <p className={`text-3xl font-bold ${stats.lowStock > 0 ? 'text-destructive' : ''}`}>
              {stats.lowStock}
            </p>
            <p className="text-xs text-muted-foreground">items ≤ 5 units</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">QUICK ACTIONS</h3>
      <div className="space-y-2">
        <Button 
          variant="outline" 
          className="w-full justify-start h-12"
          onClick={() => navigate('/service/new-order')}
          data-testid="quick-new-order"
        >
          <ShoppingCart className="h-5 w-5 mr-3" />
          Create New Order
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start h-12"
          onClick={() => navigate('/service/orders')}
          data-testid="quick-orders"
        >
          <ClipboardList className="h-5 w-5 mr-3" />
          View All Orders
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start h-12"
          onClick={() => navigate('/service/inventory')}
          data-testid="quick-inventory"
        >
          <Package className="h-5 w-5 mr-3" />
          Manage Inventory
        </Button>
      </div>
    </div>
  );
};

export default ServiceDashboard;
