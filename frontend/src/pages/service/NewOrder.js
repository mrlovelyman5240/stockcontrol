import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { inventoryApi, ordersApi, usersApi } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/utils';
import { toast } from 'sonner';
import DriverSelect from './new-order/DriverSelect';
import GiftSelector from './new-order/GiftSelector';
import ProductSearch from './new-order/ProductSearch';
import VariantDialog from './new-order/VariantDialog';
import Cart from './new-order/Cart';
import {
  ShoppingCart,
  Gift,
  Loader2,
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

  // Resolve units_per for a (product, variantName) pair. Non-variant lines = 1.
  const variantUnitsPer = (product, variantName) => {
    if (!variantName || !product?.variants?.length) return 1;
    const v = product.variants.find(vv => vv.name === variantName);
    return Math.max(1, v?.units_per ?? 1);
  };

  // Total base-stock units already committed for a product across the entire cart
  // plus the selected free gift. Used to compute remaining base stock so the UI
  // and the add/update guards match what the backend will actually accept.
  const baseConsumedForProduct = (productId, excludeCartIndex = null) => {
    const invItem = inventory.find(i => i.id === productId);
    if (!invItem) return 0;
    let consumed = 0;
    cart.forEach((line, idx) => {
      if (idx === excludeCartIndex) return;
      if (line.item_id !== productId || line.is_free_gift) return;
      consumed += line.quantity * variantUnitsPer(invItem, line.variant_name);
    });
    if (selectedGiftOption && selectedGiftOption.item_id === productId) {
      consumed += variantUnitsPer(invItem, selectedGiftOption.variant_name);
    }
    return consumed;
  };

  const remainingBaseStock = (productId, excludeCartIndex = null) => {
    const invItem = inventory.find(i => i.id === productId);
    if (!invItem) return 0;
    return Math.max(0, (invItem.stock ?? 0) - baseConsumedForProduct(productId, excludeCartIndex));
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
    const invItem = inventory.find(i => i.id === itemId);
    if (invItem && remainingBaseStock(itemId) < variantUnitsPer(invItem, variantName)) {
      toast.error('Not enough stock for this gift');
      return;
    }
    const key = variantName ? `${itemId}:::${variantName}` : itemId;
    setFreeGiftId(key);
  };

  const handleProductClick = (item) => {
    if (remainingBaseStock(item.id) <= 0) {
      toast.error('Item is out of stock');
      return;
    }
    setSelectedProduct(item);
    setVariantDialogOpen(true);
  };

  const handleAddToCartFromDialog = ({ product, variant, price }) => {
    if (!product) return;

    const variantName = variant?.name || null;
    const unitsPer = variantUnitsPer(product, variantName);
    if (remainingBaseStock(product.id) < unitsPer) {
      toast.error('Not enough stock');
      return;
    }

    const existingIndex = cart.findIndex(c =>
      c.item_id === product.id &&
      c.variant_name === variantName &&
      c.price === price &&
      !c.is_free_gift
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
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
    if (inventoryItem) {
      const unitsPer = variantUnitsPer(inventoryItem, item.variant_name);
      // Recompute base consumption excluding this line, then see if newQty fits.
      const otherConsumed = baseConsumedForProduct(item.item_id, index);
      if (otherConsumed + newQty * unitsPer > (inventoryItem.stock ?? 0)) {
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
          getRemaining={remainingBaseStock}
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
        getRemaining={remainingBaseStock}
      />

      <VariantDialog
        open={variantDialogOpen}
        product={selectedProduct}
        onOpenChange={(open) => {
          setVariantDialogOpen(open);
          if (!open) setSelectedProduct(null);
        }}
        onAddToCart={handleAddToCartFromDialog}
        getRemaining={remainingBaseStock}
      />

      <Cart
        cart={cart}
        selectedGiftOption={selectedGiftOption}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
        onSubmit={handleSubmit}
        submitting={submitting}
        canSubmit={Boolean(notes.trim() && selectedDriver)}
      />
    </div>
  );
};

export default NewOrder;
