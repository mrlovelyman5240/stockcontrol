import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ScrollArea } from '../../components/ui/scroll-area';
import { inventoryApi, ordersApi, usersApi } from '../../lib/api';
import { formatCurrency, getApiErrorMessage } from '../../lib/utils';
import { toast } from 'sonner';
import DriverSelect from './new-order/DriverSelect';
import GiftSelector from './new-order/GiftSelector';
import ProductSearch from './new-order/ProductSearch';
import VariantDialog from './new-order/VariantDialog';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Gift,
  Loader2,
  Check,
  Truck,
  ShoppingBag,
  MessageSquare
} from 'lucide-react';

const NewOrder = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [orderType, setOrderType] = useState('delivery');
  const [freeGiftId, setFreeGiftId] = useState('');
  const [cart, setCart] = useState([]);

  // Variant dialog open state — selected variant + price live inside the dialog component
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => { fetchData(); }, []);

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

  // Helper: get total stock for product (sum of variant stocks or product-level)
  const getProductTotalStock = (item) => {
    if (item.variants?.length > 0) return item.variants.reduce((s, v) => s + (v.stock ?? 0), 0);
    return item.stock;
  };

  // Derive the selected gift label from freeGiftId
  const selectedGiftOption = (() => {
    if (!freeGiftId) return null;
    // Format: "itemId:::variantName" or just "itemId"
    const [itemId, variantName] = freeGiftId.includes(':::') ? freeGiftId.split(':::') : [freeGiftId, null];
    const item = inventory.find(i => i.id === itemId);
    if (!item) return null;
    return {
      item_id: itemId,
      label: variantName ? `${item.name} - ${variantName}` : item.name,
      variant_name: variantName,
    };
  })();

  const handleGiftSelect = (itemId, variantName) => {
    const key = variantName ? `${itemId}:::${variantName}` : itemId;
    setFreeGiftId(key);
  };

  const handleProductClick = (item) => {
    const totalStock = getProductTotalStock(item);
    if (totalStock <= 0) {
      toast.error('Item is out of stock');
      return;
    }
    setSelectedProduct(item);
    setVariantDialogOpen(true);
  };

  const handleAddToCartFromDialog = ({ product, variant, price }) => {
    if (!product) return;

    const variantName = variant?.name || null;
    const existingIndex = cart.findIndex(c =>
      c.item_id === product.id &&
      c.variant_name === variantName &&
      c.price === price &&
      !c.is_free_gift
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      const maxStock = variant ? (variant.stock ?? 0) : product.stock;
      if (newCart[existingIndex].quantity >= maxStock) {
        toast.error('Not enough stock');
        return;
      }
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      const displayName = variantName
        ? `${product.name} (${variantName})`
        : product.name;
      setCart([...cart, {
        item_id: product.id,
        name: displayName,
        price,
        quantity: 1,
        variant_name: variantName,
        is_free_gift: false
      }]);
    }

    toast.success('Added to cart');
    setVariantDialogOpen(false);
    setSelectedProduct(null);
  };

  const updateQuantity = (index, delta) => {
    const newCart = [...cart];
    const item = newCart[index];
    if (item.is_free_gift) return;
    const inventoryItem = inventory.find(i => i.id === item.item_id);
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter((_, i) => i !== index));
      return;
    }
    // Use variant-level stock if variant selected
    if (inventoryItem) {
      let maxStock;
      if (item.variant_name && inventoryItem.variants?.length > 0) {
        const variant = inventoryItem.variants.find(v => v.name === item.variant_name);
        maxStock = variant ? (variant.stock ?? 0) : 0;
      } else {
        maxStock = inventoryItem.stock;
      }
      if (newQty > maxStock) {
        toast.error('Not enough stock');
        return;
      }
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

  const buildOrderItems = () => {
    const items = [...cart];
    if (freeGiftId && freeGiftId !== 'none' && selectedGiftOption) {
      items.push({
        item_id: selectedGiftOption.item_id,
        name: selectedGiftOption.label,
        price: 0,
        quantity: 1,
        variant_name: selectedGiftOption.variant_name,
        is_free_gift: true
      });
    }
    return items;
  };

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error('Please enter customer notes / address');
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
        address: notes.trim(),
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
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShoppingCart className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">New Order</h1>
          <p className="text-sm text-muted-foreground">POS</p>
        </div>
      </div>

      {/* Order Type Selection */}
      <div className="grid grid-cols-2 gap-3 mb-4" data-testid="order-type-card">
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

      {/* Customer Notes / Instructions (unified) */}
      <Card className="mb-4">
        <CardContent className="p-3">
          <Label htmlFor="notes" className="flex items-center gap-2 mb-2 text-sm">
            <MessageSquare className="h-4 w-4" />
            Customer Notes / Instructions
          </Label>
          <Input
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Address, special requests, customer name..."
            className="h-10"
            data-testid="notes-input"
          />
        </CardContent>
      </Card>

      {/* Driver + Free Gift row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <DriverSelect drivers={drivers} value={selectedDriver} onChange={setSelectedDriver} />
        <GiftSelector
          inventory={inventory}
          freeGiftId={freeGiftId}
          selectedGiftOption={selectedGiftOption}
          onSelect={handleGiftSelect}
          onClear={() => setFreeGiftId('')}
        />
      </div>

      {/* Free gift indicator */}
      {selectedGiftOption && (
        <div className="mb-4 p-2 bg-primary/10 rounded-lg flex items-center justify-between text-sm">
          <span className="font-medium text-primary">
            <Gift className="h-3 w-3 inline mr-1" />
            Free: {selectedGiftOption.label} — $0.00
          </span>
          <Button variant="ghost" size="sm" onClick={() => setFreeGiftId('')} className="h-6 px-2 text-xs" data-testid="remove-free-gift">
            Remove
          </Button>
        </div>
      )}

      <ProductSearch
        inventory={inventory}
        search={search}
        onSearchChange={setSearch}
        onProductClick={handleProductClick}
      />

      <VariantDialog
        open={variantDialogOpen}
        product={selectedProduct}
        onOpenChange={(open) => {
          setVariantDialogOpen(open);
          if (!open) setSelectedProduct(null);
        }}
        onAddToCart={handleAddToCartFromDialog}
      />

      {/* Cart */}
      {cart.length > 0 && (
        <Card className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto shadow-xl border-t z-50" data-testid="cart-summary">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Cart ({paidItems.reduce((s, i) => s + i.quantity, 0)})
              </span>
              <span className="text-primary font-bold">{formatCurrency(calculateTotal())}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <ScrollArea className="max-h-[110px] mb-3">
              <div className="space-y-1.5">
                {cart.map((item, index) => (
                  <div key={`${item.item_id}-${index}`} className="flex items-center justify-between p-1.5 rounded-lg bg-muted/50 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{formatCurrency(item.price)} x {item.quantity}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); updateQuantity(index, -1); }}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); updateQuantity(index, 1); }}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); removeFromCart(index); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {selectedGiftOption && (
              <div className="p-1.5 mb-2 rounded-lg bg-primary/10 flex items-center gap-2 text-xs">
                <Gift className="h-3 w-3 text-primary" />
                <span className="font-medium">Gift: {selectedGiftOption.label}</span>
                <span className="text-muted-foreground ml-auto">$0.00</span>
              </div>
            )}

            <Button
              className="w-full h-11"
              onClick={handleSubmit}
              disabled={submitting || !notes.trim() || !selectedDriver}
              data-testid="submit-order"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Check className="h-5 w-5 mr-2" />
              )}
              Place Order — {formatCurrency(calculateTotal())}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NewOrder;
