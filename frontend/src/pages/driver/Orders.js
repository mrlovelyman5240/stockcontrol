import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ordersApi } from '../../lib/api';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel, getOrderBorderColor, getOrderTypeBadge } from '../../lib/utils';
import { toast } from 'sonner';
import { 
  ClipboardList, 
  MapPin, 
  Package,
  Loader2,
  RefreshCw,
  CheckCircle,
  Clock,
  Truck,
  ShoppingBag,
  XCircle
} from 'lucide-react';

const DriverOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await ordersApi.getAll();
      setOrders(response.data);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  // Sort: pending first
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;

  return (
    <div className="p-4 max-w-2xl mx-auto" data-testid="driver-orders">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Orders</h1>
            <p className="text-muted-foreground">
              {pendingCount} pending · {completedCount} completed
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchOrders} data-testid="refresh-orders">
          <RefreshCw className="h-5 w-5" />
        </Button>
      </div>

      {/* Filter */}
      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-full mb-4" data-testid="filter-orders">
          <SelectValue placeholder="Filter orders" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Orders</SelectItem>
          <SelectItem value="pending">Pending (To Deliver)</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      {/* Orders List */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-3">
          {sortedOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No orders found</p>
            </div>
          ) : (
            sortedOrders.map((order) => (
              <Card
                key={order.id}
                className={`border-l-4 ${getOrderBorderColor(order.status)}`}
                data-testid={`order-${order.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={getStatusColor(order.status)}>
                          {getStatusLabel(order.status)}
                        </Badge>
                        <Badge className={getOrderTypeBadge(order.order_type).className}>
                          {order.order_type === 'pickup' ? <ShoppingBag className="h-3 w-3 mr-1" /> : <Truck className="h-3 w-3 mr-1" />}
                          {getOrderTypeBadge(order.order_type).label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          #{order.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{order.address}</span>
                      </div>
                    </div>
                    <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                  </div>

                  {/* Items */}
                  <div className="text-sm text-muted-foreground mb-3 p-2 bg-muted/50 rounded-lg">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>
                          {item.quantity}x {item.name}
                          {item.is_free_gift && <span className="text-primary ml-1">(Free)</span>}
                        </span>
                        <span>{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Status Display */}
                  {order.status === 'pending' && (
                    <div className="flex items-center justify-center gap-2 text-amber-600 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <Clock className="h-5 w-5" />
                      <span className="font-medium">Pending - Deliver to customer</span>
                    </div>
                  )}

                  {order.status === 'completed' && (
                    <div className="flex items-center justify-center gap-2 text-primary py-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Completed</span>
                    </div>
                  )}

                  {order.status === 'cancelled' && (
                    <div className="flex items-center justify-center gap-2 text-destructive py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <XCircle className="h-5 w-5" />
                      <span className="font-medium">Cancelled</span>
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    {formatDateTime(order.created_at)}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Info Note */}
      <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center text-sm text-muted-foreground">
        <p>Customer Service will mark orders as "Done" after delivery confirmation</p>
      </div>
    </div>
  );
};

export default DriverOrders;
