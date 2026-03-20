import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { statsApi, paymentsApi, ordersApi } from '../../lib/api';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel } from '../../lib/utils';
import { toast } from 'sonner';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Package,
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Moon,
  Sun,
  LogOut,
  MapPin
} from 'lucide-react';

const BossDashboard = () => {
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

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

  useEffect(() => {
    fetchStats();
  }, []);

  const handleApprovePayment = async (paymentId) => {
    setActionLoading(paymentId);
    try {
      await paymentsApi.approve(paymentId);
      toast.success('Payment approved');
      fetchStats();
    } catch (error) {
      toast.error('Failed to approve payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPayment = async (paymentId) => {
    setActionLoading(paymentId);
    try {
      await paymentsApi.reject(paymentId);
      toast.success('Payment rejected');
      fetchStats();
    } catch (error) {
      toast.error('Failed to reject payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveOrder = async (orderId) => {
    setActionLoading(orderId);
    try {
      await ordersApi.approve(orderId);
      toast.success('Order approved! Amount added to financials.');
      fetchStats();
    } catch (error) {
      toast.error('Failed to approve order');
    } finally {
      setActionLoading(null);
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
    <div className="p-4 max-w-2xl mx-auto" data-testid="boss-dashboard">
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Hero Card - Net Profit */}
        <Card className="col-span-2 hero-gradient text-white" data-testid="net-profit-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2 opacity-90">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm font-medium">Net Profit</span>
            </div>
            <p className="money-large">{formatCurrency(stats?.net_profit || 0)}</p>
            <p className="text-sm opacity-80 mt-2">
              From {stats?.approved_orders || 0} approved orders
            </p>
          </CardContent>
        </Card>

        {/* Total Order Value */}
        <Card data-testid="total-orders-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Total Orders</span>
            </div>
            <p className="money-medium">{formatCurrency(stats?.total_order_value || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.total_orders || 0} orders
            </p>
          </CardContent>
        </Card>

        {/* Staff Payments */}
        <Card data-testid="staff-payments-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Staff Payments</span>
            </div>
            <p className="money-medium">{formatCurrency(stats?.total_staff_payments || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.approved_orders || 0} approved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different approval sections */}
      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="orders" data-testid="orders-tab">
            Orders
            {stats?.awaiting_approval_count > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.awaiting_approval_count}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="collections" data-testid="collections-tab">
            Collections
            {stats?.pending_collections?.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.pending_collections.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments" data-testid="payments-tab">
            Payments
            {stats?.pending_payments?.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.pending_payments.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Orders Awaiting Approval */}
        <TabsContent value="orders">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Awaiting Your Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.awaiting_approval?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No orders awaiting approval</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[350px]">
                  <div className="space-y-3">
                    {stats?.awaiting_approval?.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 bg-muted/50 rounded-xl border-l-4 border-l-orange-500"
                        data-testid={`order-approval-${order.id}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                                Awaiting Approval
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              <span>{order.address}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Driver: <strong>{order.driver_name}</strong>
                            </p>
                          </div>
                          <p className="font-bold text-xl">{formatCurrency(order.total)}</p>
                        </div>
                        <div className="text-xs text-muted-foreground mb-3">
                          {order.items?.map((item, idx) => (
                            <span key={idx}>
                              {item.quantity}x {item.name}
                              {idx < order.items.length - 1 && ', '}
                            </span>
                          ))}
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => handleApproveOrder(order.id)}
                          disabled={actionLoading === order.id}
                          data-testid={`approve-order-${order.id}`}
                        >
                          {actionLoading === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Approve Order
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Delivered: {formatDateTime(order.delivered_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Collections */}
        <TabsContent value="collections">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Driver Holdings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.pending_collections?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>All collections up to date!</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-3">
                    {stats?.pending_collections?.map((item) => (
                      <div
                        key={item.driver_id}
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"
                        data-testid={`collection-${item.driver_id}`}
                      >
                        <div>
                          <p className="font-semibold">{item.driver_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Sales: {formatCurrency(item.total_sales)} | Earnings: {formatCurrency(item.driver_earnings)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-accent">
                            {formatCurrency(item.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">Holding</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Requests */}
        <TabsContent value="payments">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Payment Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.pending_payments?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No pending payment requests</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-3">
                    {stats?.pending_payments?.map((payment) => (
                      <div
                        key={payment.id}
                        className="p-4 bg-muted/50 rounded-xl"
                        data-testid={`payment-${payment.id}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold">{payment.driver_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(payment.submitted_at)}
                            </p>
                          </div>
                          <p className="font-bold text-xl">{formatCurrency(payment.amount)}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleApprovePayment(payment.id)}
                            disabled={actionLoading === payment.id}
                            data-testid={`approve-payment-${payment.id}`}
                          >
                            {actionLoading === payment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            onClick={() => handleRejectPayment(payment.id)}
                            disabled={actionLoading === payment.id}
                            data-testid={`reject-payment-${payment.id}`}
                          >
                            {actionLoading === payment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BossDashboard;
