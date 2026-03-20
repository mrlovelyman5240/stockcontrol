import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ordersApi, usersApi } from '../../lib/api';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel, getOrderBorderColor } from '../../lib/utils';
import { toast } from 'sonner';
import { 
  ClipboardList, 
  Search, 
  MapPin, 
  Package,
  User,
  Loader2,
  RefreshCw,
  Truck
} from 'lucide-react';

const BossOrders = () => {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, driversRes] = await Promise.all([
        ordersApi.getAll(),
        usersApi.getDrivers()
      ]);
      setOrders(ordersRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDriver = async (orderId, driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;

    setActionLoading(orderId);
    try {
      await ordersApi.update(orderId, {
        driver_id: driverId,
        driver_name: driver.username,
        status: 'assigned'
      });
      toast.success(`Order assigned to ${driver.username}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to assign driver');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setActionLoading(orderId);
    try {
      await ordersApi.update(orderId, { status: newStatus });
      toast.success(`Order status updated to ${getStatusLabel(newStatus)}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch = order.address.toLowerCase().includes(search.toLowerCase()) ||
                         order.id.toLowerCase().includes(search.toLowerCase());
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
            <h1 className="text-2xl font-bold">Orders</h1>
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
            placeholder="Search by address..."
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
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

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

                  {/* Driver Assignment */}
                  {order.status === 'pending' && (
                    <Select
                      onValueChange={(driverId) => handleAssignDriver(order.id, driverId)}
                      disabled={actionLoading === order.id}
                    >
                      <SelectTrigger className="w-full" data-testid={`assign-driver-${order.id}`}>
                        <SelectValue placeholder="Assign to driver..." />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {driver.username}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Assigned Driver Info */}
                  {order.driver_name && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span>Driver: <strong>{order.driver_name}</strong></span>
                      </div>
                      {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <Select
                          value={order.status}
                          onValueChange={(status) => handleStatusChange(order.id, status)}
                          disabled={actionLoading === order.id}
                        >
                          <SelectTrigger className="w-[130px]" data-testid={`status-${order.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="assigned">Assigned</SelectItem>
                            <SelectItem value="in_transit">In Transit</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

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
