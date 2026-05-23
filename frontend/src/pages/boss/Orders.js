import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ordersApi, usersApi } from '../../lib/api';
import EmptyState from '../../components/EmptyState';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel, getOrderBorderColor, getOrderTypeBadge } from '../../lib/utils';
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
  ShoppingBag
} from 'lucide-react';

const BossOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const ordersRes = await ordersApi.getAll();
      setOrders(ordersRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveOrder = async (orderId) => {
    setActionLoading(orderId);
    try {
      await ordersApi.approve(orderId);
      toast.success('Order approved!');
      fetchData();
    } catch (error) {
      toast.error('Failed to approve order');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto" data-testid="boss-orders">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">All Orders</h1>
            <p className="text-muted-foreground">{orders.length} total orders</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchData} data-testid="refresh-orders">
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
          <SelectTrigger className="w-[160px]" data-testid="filter-orders">
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
          {filteredOrders.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No orders found"
              description="No orders match the current filters."
            />
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

                  {/* Driver Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span>Driver: <strong>{order.driver_name || 'Not assigned'}</strong></span>
                    </div>
                    
                    {/* Approve button for awaiting orders */}
                    {order.status === 'awaiting_boss_approval' && (
                      <Button
                        size="sm"
                        onClick={() => handleApproveOrder(order.id)}
                        disabled={actionLoading === order.id}
                        data-testid={`approve-order-${order.id}`}
                      >
                        {actionLoading === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Timestamp */}
                  <p className="text-xs text-muted-foreground mt-3">
                    Created: {formatDateTime(order.created_at)} by {order.created_by_name}
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

export default BossOrders;
