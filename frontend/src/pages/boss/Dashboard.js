import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { statsApi, paymentsApi } from '../../lib/api';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel } from '../../lib/utils';
import { toast } from 'sonner';
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
  Sun
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const BossDashboard = () => {
  const { user } = useAuth();
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
              After staff payments from delivered orders
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
              {stats?.delivered_orders || 0} delivered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Pending Collections & Payments */}
      <Tabs defaultValue="collections" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="collections" data-testid="collections-tab">
            Pending Collections
            {stats?.pending_collections?.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.pending_collections.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments" data-testid="payments-tab">
            Payment Requests
            {stats?.pending_payments?.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.pending_payments.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

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
                Pending Approvals
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
                            data-testid={`approve-${payment.id}`}
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
                            data-testid={`reject-${payment.id}`}
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
