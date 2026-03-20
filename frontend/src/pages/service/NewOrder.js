import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { inventoryApi, ordersApi, usersApi } from '../../lib/api';
import { formatCurrency, getApiErrorMessage } from '../../lib/utils';
import { toast } from 'sonner';
import { 
  ShoppingCart, 
  Plus, 
  Minus,
  Trash2,
  MapPin,
  Package,
  Gift,
  AlertTriangle,
  Loader2,
  Check,
  Search,
  Truck,
  User,
  ShoppingBag
} from 'lucide-react';

const NewOrder = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [address, setAddress] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [orderType, setOrderType] = useState('delivery');
  const [freeGiftId, setFreeGiftId] = useState('');
  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [inventoryRes, driversRes] = await Promise.all([
        inventoryApi.getAll(),
        usersApi.getDrivers()
      ]);
      setInventory(inventoryRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item) => {
    if (item.stock <= 0) {
      toast.error('Item is out of stock');
      return;
    }

    const existingIndex = cart.findIndex(c => c.item_id === item.id && !c.is_free_gift);
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      const currentQty = newCart[existingIndex].quantity;
      
      if (currentQty >= item.stock) {
        toast.error('Not enough stock');
        return;
      }
      
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, {
        item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        is_free_gift: false
      }]);
    }
    
    toast.success(`Added ${item.name} to cart`);
  };

  const updateQuantity = (index, delta) => {
    const newCart = [...cart];
    const item = newCart[index];
    const inventoryItem = inventory.find(i => i.id === item.item_id);
    
    if (item.is_free_gift) return;
    
    const newQty = item.quantity + delta;
    
    if (newQty <= 0) {
      setCart(cart.filter((_, i) => i !== index));
      return;
    }
    
    if (inventoryItem && newQty > inventoryItem.stock) {
      toast.error('Not enough stock');
      return;
    }
    
    newCart[index].quantity = newQty;
    setCart(newCart);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // Build final items list including free gift
  const buildOrderItems = () => {
    const items = [...cart];
    if (freeGiftId && freeGiftId !== 'none') {
      const giftItem = inventory.find(i => i.id === freeGiftId);
      if (giftItem) {
        items.push({
          item_id: giftItem.id,
          name: giftItem.name,
          price: 0,
          quantity: 1,
          is_free_gift: true
        });
      }
    }
    return items;
  };

  const handleSubmit = async () => {
    if (!address.trim()) {
      toast.error('Please enter delivery address');
      return;
    }
    
    if (!selectedDriver) {
      toast.error('Please select a driver');
      return;
    }
    
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const driver = drivers.find(d => d.id === selectedDriver);
    if (!driver) {
      toast.error('Invalid driver selected');
      return;
    }

    setSubmitting(true);
    try {
      await ordersApi.create({
        address: address.trim(),
        items: buildOrderItems(),
        total: calculateTotal(),
        order_type: orderType,
        driver_id: selectedDriver,
        driver_name: driver.username
      });
      
      toast.success('Order created successfully!');
      navigate('/service');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to create order'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const paidItems = cart.filter(c => !c.is_free_gift);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-48" data-testid="new-order-page">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShoppingCart className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">New Order</h1>
          <p className="text-muted-foreground">Create a delivery order</p>
        </div>
      </div>

      {/* Order Type Selection */}
      <Card className="mb-4" data-testid="order-type-card">
        <CardContent className="p-4">
          <Label className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4" />
            Order Type <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setOrderType('delivery')}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-medium ${
                orderType === 'delivery'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
              data-testid="order-type-delivery"
            >
              <Truck className="h-5 w-5" />
              Delivery
            </button>
            <button
              type="button"
              onClick={() => setOrderType('pickup')}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-medium ${
                orderType === 'pickup'
                  ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
              data-testid="order-type-pickup"
            >
              <ShoppingBag className="h-5 w-5" />
              Pickup
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Address Input */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <Label htmlFor="address" className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4" />
            {orderType === 'pickup' ? 'Pickup Notes / Customer Info' : 'Delivery Address'}
          </Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={orderType === 'pickup' ? 'Customer name or notes...' : 'Enter delivery address...'}
            className="h-12"
            data-testid="address-input"
          />
        </CardContent>
      </Card>

      {/* Driver Selection */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <Label className="flex items-center gap-2 mb-2">
            <Truck className="h-4 w-4" />
            Assign Driver <span className="text-destructive">*</span>
          </Label>
          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
            <SelectTrigger className="h-12" data-testid="driver-select">
              <SelectValue placeholder="Select a driver..." />
            </SelectTrigger>
            <SelectContent>
              {drivers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No drivers available
                </div>
              ) : (
                drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {driver.username}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Free Gift Selection */}
      <Card className="mb-4" data-testid="free-gift-card">
        <CardContent className="p-4">
          <Label className="flex items-center gap-2 mb-2">
            <Gift className="h-4 w-4 text-primary" />
            Free Gift (Optional Promo)
          </Label>
          <Select value={freeGiftId} onValueChange={setFreeGiftId}>
            <SelectTrigger className="h-12" data-testid="free-gift-select">
              <SelectValue placeholder="Select a free gift item..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No free gift</SelectItem>
              {inventory.filter(i => i.stock > 0).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    {item.name} ({item.stock} available)
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {freeGiftId && freeGiftId !== 'none' && (
            <div className="mt-2 p-2 bg-primary/10 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium text-primary">
                <Gift className="h-3 w-3 inline mr-1" />
                {inventory.find(i => i.id === freeGiftId)?.name} - $0.00
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFreeGiftId('')}
                className="h-6 px-2 text-xs"
                data-testid="remove-free-gift"
              >
                Remove
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="search-products"
        />
      </div>

      {/* Products Grid */}
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">SELECT PRODUCTS</h3>
      <ScrollArea className="h-[250px] mb-4">
        <div className="grid grid-cols-2 gap-3">
          {filteredInventory.map((item) => (
            <Card 
              key={item.id} 
              className={`cursor-pointer transition-all ${item.stock <= 0 ? 'opacity-50' : 'hover:shadow-md'}`}
              onClick={() => addToCart(item)}
              data-testid={`product-${item.id}`}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
                </div>
                <p className="font-bold">{formatCurrency(item.price)}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-xs ${item.stock <= 5 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {item.stock <= 0 ? (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Out of Stock
                      </span>
                    ) : (
                      `${item.stock} available`
                    )}
                  </span>
                  {item.stock > 0 && (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Plus className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Cart */}
      {cart.length > 0 && (
        <Card className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto shadow-xl border-t" data-testid="cart-summary">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Cart ({paidItems.length} items)</span>
              <span className="text-primary">{formatCurrency(calculateTotal())}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ScrollArea className="max-h-[120px] mb-4">
              <div className="space-y-2">
                {cart.map((item, index) => (
                  <div 
                    key={`${item.item_id}-${index}`} 
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(item.price)} x {item.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); updateQuantity(index, -1); }}
                        data-testid={`decrease-${item.item_id}`}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-6 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); updateQuantity(index, 1); }}
                        data-testid={`increase-${item.item_id}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeFromCart(index); }}
                        data-testid={`remove-${item.item_id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Free gift preview in cart */}
            {freeGiftId && freeGiftId !== 'none' && (
              <div className="p-2 mb-3 rounded-lg bg-primary/10 flex items-center gap-2 text-sm">
                <Gift className="h-4 w-4 text-primary" />
                <span className="font-medium">Free Gift: {inventory.find(i => i.id === freeGiftId)?.name}</span>
                <span className="text-muted-foreground ml-auto">$0.00</span>
              </div>
            )}

            <Button
              className="w-full h-12"
              onClick={handleSubmit}
              disabled={submitting || !address.trim() || !selectedDriver}
              data-testid="submit-order"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Check className="h-5 w-5 mr-2" />
              )}
              Place Order - {formatCurrency(calculateTotal())}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NewOrder;
