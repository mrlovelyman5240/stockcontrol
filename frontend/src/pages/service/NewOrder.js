import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { inventoryApi, ordersApi } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
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
  Search
} from 'lucide-react';

const NewOrder = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [address, setAddress] = useState('');
  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await inventoryApi.getAll();
      setInventory(response.data);
    } catch (error) {
      toast.error('Failed to load inventory');
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
      
      // Check stock
      if (currentQty >= item.stock) {
        toast.error('Not enough stock');
        return;
      }
      
      newCart[existingIndex].quantity += 1;
      
      // Handle BOGO
      if (item.bogo_enabled) {
        const freeIndex = cart.findIndex(c => c.item_id === item.id && c.is_free_gift);
        if (freeIndex >= 0) {
          newCart[freeIndex].quantity = Math.floor(newCart[existingIndex].quantity);
        } else if (newCart[existingIndex].quantity >= 1) {
          newCart.push({
            item_id: item.id,
            name: item.name,
            price: 0,
            quantity: Math.floor(newCart[existingIndex].quantity),
            is_free_gift: true
          });
        }
      }
      
      setCart(newCart);
    } else {
      const newCartItems = [{
        item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        is_free_gift: false
      }];
      
      // Add free item for BOGO
      if (item.bogo_enabled) {
        newCartItems.push({
          item_id: item.id,
          name: item.name,
          price: 0,
          quantity: 1,
          is_free_gift: true
        });
      }
      
      setCart([...cart, ...newCartItems]);
    }
    
    toast.success(`Added ${item.name} to cart`);
  };

  const updateQuantity = (index, delta) => {
    const newCart = [...cart];
    const item = newCart[index];
    const inventoryItem = inventory.find(i => i.id === item.item_id);
    
    if (item.is_free_gift) return; // Can't modify free gifts directly
    
    const newQty = item.quantity + delta;
    
    if (newQty <= 0) {
      // Remove item and its free gift
      setCart(cart.filter(c => c.item_id !== item.item_id));
      return;
    }
    
    if (newQty > inventoryItem.stock) {
      toast.error('Not enough stock');
      return;
    }
    
    newCart[index].quantity = newQty;
    
    // Update free gift quantity
    if (inventoryItem.bogo_enabled) {
      const freeIndex = newCart.findIndex(c => c.item_id === item.item_id && c.is_free_gift);
      if (freeIndex >= 0) {
        newCart[freeIndex].quantity = Math.floor(newQty);
      }
    }
    
    setCart(newCart);
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(c => c.item_id !== itemId));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async () => {
    if (!address.trim()) {
      toast.error('Please enter delivery address');
      return;
    }
    
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    setSubmitting(true);
    try {
      await ordersApi.create({
        address: address.trim(),
        items: cart,
        total: calculateTotal()
      });
      
      toast.success('Order created successfully!');
      navigate('/service');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const paidItems = cart.filter(c => !c.is_free_gift);
  const freeItems = cart.filter(c => c.is_free_gift);

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

      {/* Address Input */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <Label htmlFor="address" className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4" />
            Delivery Address
          </Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter delivery address..."
            className="h-12"
            data-testid="address-input"
          />
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
      <ScrollArea className="h-[300px] mb-4">
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
                  {item.bogo_enabled && (
                    <Badge className="bg-primary/10 text-primary text-xs shrink-0 ml-1">
                      <Gift className="h-3 w-3 mr-0.5" />
                      BOGO
                    </Badge>
                  )}
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
            <ScrollArea className="max-h-[150px] mb-4">
              <div className="space-y-2">
                {cart.map((item, index) => (
                  <div 
                    key={`${item.item_id}-${item.is_free_gift}`} 
                    className={`flex items-center justify-between p-2 rounded-lg ${item.is_free_gift ? 'bg-primary/10' : 'bg-muted/50'}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {item.name}
                        {item.is_free_gift && (
                          <Badge className="ml-2 bg-primary text-white text-xs">Free Gift</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.is_free_gift ? '$0.00' : formatCurrency(item.price)} × {item.quantity}
                      </p>
                    </div>
                    {!item.is_free_gift && (
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
                          onClick={(e) => { e.stopPropagation(); removeFromCart(item.item_id); }}
                          data-testid={`remove-${item.item_id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Button
              className="w-full h-12"
              onClick={handleSubmit}
              disabled={submitting || !address.trim()}
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
