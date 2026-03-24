import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/ui/command';
import { inventoryApi, ordersApi, usersApi } from '../../lib/api';
import { formatCurrency, getApiErrorMessage } from '../../lib/utils';
import { toast } from 'sonner';
import { 
  ShoppingCart, 
  Plus, 
  Minus,
  Trash2,
  Gift,
  AlertTriangle,
  Loader2,
  Check,
  Search,
  Truck,
  User,
  ShoppingBag,
  MessageSquare,
  Layers,
  ChevronRight,
  ChevronsUpDown
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
  const [giftPopoverOpen, setGiftPopoverOpen] = useState(false);
  const [cart, setCart] = useState([]);

  // Variant selection state
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [customPrice, setCustomPrice] = useState('');

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

  // Build flat list of gift options: products without variants + individual variants
  const giftOptions = inventory
    .filter(item => item.stock > 0)
    .flatMap(item => {
      if (item.variants?.length > 0) {
        return item.variants.map(v => ({
          key: `${item.id}:::${v.name}`,
          item_id: item.id,
          label: `${item.name} - ${v.name}`,
          variant_name: v.name,
          stock: item.stock,
        }));
      }
      return [{
        key: item.id,
        item_id: item.id,
        label: item.name,
        variant_name: null,
        stock: item.stock,
      }];
    });

  const selectedGiftOption = giftOptions.find(g => g.key === freeGiftId);

  // Product click handler — opens variant dialog or adds directly
  const handleProductClick = (item) => {
    if (item.stock <= 0) {
      toast.error('Item is out of stock');
      return;
    }

    if (item.variants?.length > 0) {
      setSelectedProduct(item);
      setSelectedVariant(null);
      setCustomPrice('');
      setVariantDialogOpen(true);
    } else {
      // No variants → add directly with base price (open dialog for editable price)
      setSelectedProduct(item);
      setSelectedVariant(null);
      setCustomPrice(item.price.toString());
      setVariantDialogOpen(true);
    }
  };

  const handleVariantSelect = (variant) => {
    setSelectedVariant(variant);
    setCustomPrice(variant.price.toString());
  };

  const handleAddToCartFromDialog = () => {
    if (!selectedProduct) return;
    const price = parseFloat(customPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid price');
      return;
    }

    const variantName = selectedVariant?.name || null;
    const cartKey = `${selectedProduct.id}-${variantName || 'base'}-${price}`;
    const existingIndex = cart.findIndex(c => 
      c.item_id === selectedProduct.id && 
      c.variant_name === variantName && 
      c.price === price &&
      !c.is_free_gift
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      if (newCart[existingIndex].quantity >= selectedProduct.stock) {
        toast.error('Not enough stock');
        return;
      }
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      const displayName = variantName 
        ? `${selectedProduct.name} (${variantName})`
        : selectedProduct.name;
      setCart([...cart, {
        item_id: selectedProduct.id,
        name: displayName,
        price,
        quantity: 1,
        variant_name: variantName,
        is_free_gift: false
      }]);
    }

    toast.success(`Added to cart`);
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
        <div>
          <Label className="flex items-center gap-1 mb-1.5 text-xs font-medium text-muted-foreground">
            <Truck className="h-3 w-3" />
            Driver <span className="text-destructive">*</span>
          </Label>
          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
            <SelectTrigger className="h-10" data-testid="driver-select">
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  <span className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    {driver.username}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="flex items-center gap-1 mb-1.5 text-xs font-medium text-muted-foreground">
            <Gift className="h-3 w-3" />
            Free Gift
          </Label>
          <Popover open={giftPopoverOpen} onOpenChange={setGiftPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={giftPopoverOpen}
                className="w-full h-10 justify-between font-normal text-left"
                data-testid="free-gift-select"
              >
                <span className="truncate">
                  {selectedGiftOption ? selectedGiftOption.label : 'None'}
                </span>
                <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search gift items..." data-testid="gift-search-input" />
                <CommandList>
                  <CommandEmpty>No items found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="none"
                      onSelect={() => { setFreeGiftId(''); setGiftPopoverOpen(false); }}
                      data-testid="gift-option-none"
                    >
                      <Check className={`mr-2 h-4 w-4 ${!freeGiftId || freeGiftId === 'none' ? 'opacity-100' : 'opacity-0'}`} />
                      No free gift
                    </CommandItem>
                    {giftOptions.map((opt) => (
                      <CommandItem
                        key={opt.key}
                        value={opt.label}
                        onSelect={() => { setFreeGiftId(opt.key); setGiftPopoverOpen(false); }}
                        data-testid={`gift-option-${opt.key}`}
                      >
                        <Check className={`mr-2 h-4 w-4 ${freeGiftId === opt.key ? 'opacity-100' : 'opacity-0'}`} />
                        <div className="flex flex-col">
                          <span className="text-sm">{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.stock} in stock</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
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

      {/* Compact Product Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10"
          data-testid="search-products"
        />
      </div>

      {/* Compact Product List */}
      <ScrollArea className="h-[220px] mb-4 border rounded-xl">
        <div className="divide-y">
          {filteredInventory.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleProductClick(item)}
              disabled={item.stock <= 0}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                item.stock <= 0 
                  ? 'opacity-40 cursor-not-allowed' 
                  : 'hover:bg-muted/60 active:bg-muted'
              }`}
              data-testid={`product-${item.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{item.name}</span>
                  {item.variants?.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      <Layers className="h-2.5 w-2.5 mr-0.5" />
                      {item.variants.length}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.variants?.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(Math.min(...item.variants.map(v => v.price)))} – {formatCurrency(Math.max(...item.variants.map(v => v.price)))}
                    </span>
                  ) : (
                    <span className="text-xs font-medium">{formatCurrency(item.price)}</span>
                  )}
                  <span className={`text-xs ${item.stock <= 5 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {item.stock <= 0 ? (
                      <span className="flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> Out</span>
                    ) : `${item.stock} left`}
                  </span>
                </div>
              </div>
              {item.stock > 0 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
              )}
            </button>
          ))}
          {filteredInventory.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">No products found</div>
          )}
        </div>
      </ScrollArea>

      {/* Variant/Price Selection Dialog */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">{selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Variant options */}
            {selectedProduct?.variants?.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Select Variant</Label>
                <div className="grid grid-cols-1 gap-2">
                  {selectedProduct.variants.map((v, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleVariantSelect(v)}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${
                        selectedVariant?.name === v.name
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/40'
                      }`}
                      data-testid={`variant-option-${idx}`}
                    >
                      <span className="font-medium text-sm">{v.name}</span>
                      <span className="text-sm font-semibold">{formatCurrency(v.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Editable Price */}
            <div className="space-y-2">
              <Label htmlFor="custom-price" className="text-sm text-muted-foreground flex items-center justify-between">
                <span>Price (editable for discounts)</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">$</span>
                <Input
                  id="custom-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="h-12 text-lg font-semibold"
                  data-testid="custom-price-input"
                />
              </div>
            </div>

            {/* Add to cart */}
            <Button
              className="w-full h-11"
              onClick={handleAddToCartFromDialog}
              disabled={!customPrice || (selectedProduct?.variants?.length > 0 && !selectedVariant)}
              data-testid="add-to-cart-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to Cart — {customPrice ? formatCurrency(parseFloat(customPrice) || 0) : '$0.00'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
