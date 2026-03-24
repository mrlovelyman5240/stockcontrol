import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ordersApi, photosApi } from '../../lib/api';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel, getOrderBorderColor, getOrderTypeBadge, getApiErrorMessage } from '../../lib/utils';
import { toast } from 'sonner';
import { 
  ClipboardList, 
  Search, 
  MapPin, 
  Package,
  Loader2,
  RefreshCw,
  Truck,
  CheckCircle,
  XCircle,
  ShoppingBag,
  Image as ImageIcon
} from 'lucide-react';

const ServiceOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedPhoto, setExpandedPhoto] = useState(null);

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

  const handleMarkDone = async (orderId) => {
    setActionLoading(orderId);
    try {
      await ordersApi.complete(orderId);
      toast.success('Order marked as Done! Amount added to financials.');
      fetchOrders();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to complete order'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (orderId) => {
    setActionLoading(orderId + '-cancel');
    try {
      await ordersApi.cancel(orderId);
      toast.success('Order cancelled. Inventory restored.');
      fetchOrders();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to cancel order'));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch = order.address.toLowerCase().includes(search.toLowerCase()) ||
                         order.id.toLowerCase().includes(search.toLowerCase()) ||
                         (order.driver_name && order.driver_name.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Sort: pending first, then completed
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
    <div className="p-4 max-w-2xl mx-auto" data-testid="service-orders">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Orders</h1>
            <p className="text-muted-foreground">
              {pendingCount} pending · {completedCount} completed
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchOrders} data-testid="refresh-orders">
          <RefreshCw className="h-5 w-5" />
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address or driver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="search-orders"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[140px]" data-testid="filter-orders">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />
                        <span className="line-clamp-1">{order.address}</span>
                      </div>
                    </div>
                    <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                  </div>

                  {/* Items */}
                  <div className="text-sm text-muted-foreground mb-3">
                    {order.items.map((item, idx) => (
                      <span key={idx}>
                        {item.quantity}x {item.name}
                        {item.is_free_gift && <span className="text-primary"> (Free)</span>}
                        {idx < order.items.length - 1 && ', '}
                      </span>
                    ))}
                  </div>

                  {/* Driver & Action */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span>Driver: <strong>{order.driver_name}</strong></span>
                    </div>
                    
                    {/* Mark as Done and Cancel buttons for pending orders */}
                    {order.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleCancel(order.id)}
                          disabled={actionLoading === order.id + '-cancel'}
                          data-testid={`cancel-order-${order.id}`}
                        >
                          {actionLoading === order.id + '-cancel' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-1" />
                              Cancel
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleMarkDone(order.id)}
                          disabled={actionLoading === order.id}
                          data-testid={`complete-order-${order.id}`}
                        >
                          {actionLoading === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark Done
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {order.status === 'completed' && (
                      <div className="flex items-center gap-1 text-primary text-sm">
                        <CheckCircle className="h-4 w-4" />
                        <span>Done</span>
                      </div>
                    )}

                    {order.status === 'cancelled' && (
                      <div className="flex items-center gap-1 text-destructive text-sm">
                        <XCircle className="h-4 w-4" />
                        <span>Cancelled</span>
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <p className="text-xs text-muted-foreground mt-3">
                    Created: {formatDateTime(order.created_at)}
                  </p>

                  {/* Delivery Proof Photo */}
                  {order.proof_photo_id && (
                    <div className="mt-2">
                      {expandedPhoto === order.id ? (
                        <div className="relative rounded-lg overflow-hidden border cursor-pointer" onClick={() => setExpandedPhoto(null)} data-testid={`proof-photo-${order.id}`}>
                          <img src={photosApi.getUrl(order.proof_photo_id)} alt="Delivery proof" className="w-full h-48 object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1.5 flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" /> Delivery Proof (tap to close)
                          </div>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="gap-1 text-xs mt-1" onClick={() => setExpandedPhoto(order.id)} data-testid={`view-proof-btn-${order.id}`}>
                          <ImageIcon className="h-3 w-3" /> View Delivery Proof
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ServiceOrders;
