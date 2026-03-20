import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ordersApi } from '../../lib/api';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel, getOrderBorderColor } from '../../lib/utils';
import { toast } from 'sonner';
import { 
  ClipboardList, 
  MapPin, 
  Package,
  Loader2,
  RefreshCw,
  CheckCircle,
  Truck
} from 'lucide-react';

const DriverOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

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

  const handleStatusChange = async (orderId, newStatus) => {
    setActionLoading(orderId);
    try {
      await ordersApi.update(orderId, { status: newStatus });
      toast.success(`Order marked as ${getStatusLabel(newStatus)}`);
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['assigned', 'in_transit'].includes(order.status);
    return order.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            <p className="text-muted-foreground">{orders.length} orders assigned</p>
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
          <SelectItem value="active">Active (To Deliver)</SelectItem>
          <SelectItem value="assigned">Assigned</SelectItem>
          <SelectItem value="in_transit">In Transit</SelectItem>
          <SelectItem value="delivered">Delivered</SelectItem>
        </SelectContent>
      </Select>

      {/* Orders List */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No orders found</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <Card
                key={order.id}
                className={`border-l-4 ${getOrderBorderColor(order.status)}`}
                data-testid={`order-${order.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getStatusColor(order.status)}>
                          {getStatusLabel(order.status)}
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

                  {/* Actions */}
                  {order.status === 'assigned' && (
                    <Button
                      className="w-full"
                      onClick={() => handleStatusChange(order.id, 'in_transit')}
                      disabled={actionLoading === order.id}
                      data-testid={`start-delivery-${order.id}`}
                    >
                      {actionLoading === order.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Truck className="h-4 w-4 mr-2" />
                      )}
                      Start Delivery
                    </Button>
                  )}

                  {order.status === 'in_transit' && (
                    <Button
                      className="w-full bg-primary"
                      onClick={() => handleStatusChange(order.id, 'delivered')}
                      disabled={actionLoading === order.id}
                      data-testid={`complete-delivery-${order.id}`}
                    >
                      {actionLoading === order.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Mark Delivered
                    </Button>
                  )}

                  {order.status === 'delivered' && (
                    <div className="flex items-center justify-center gap-2 text-primary py-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Delivered</span>
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
    </div>
  );
};

export default DriverOrders;
