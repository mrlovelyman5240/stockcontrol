import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { inventoryApi } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';
import {
  Package, Plus, Pencil, Trash2, Search, Loader2, AlertTriangle, X, Layers
} from 'lucide-react';

const Inventory = ({ role = 'boss' }) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', price: '', stock: '', variants: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchInventory(); }, []);

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

  const openDialog = (item = null) => {
    if (item) {
      setEditItem(item);
      setFormData({
        name: item.name,
        price: item.price.toString(),
        stock: item.stock?.toString() || '0',
        variants: item.variants?.length
          ? item.variants.map(v => ({ name: v.name, price: v.price.toString(), stock: (v.stock ?? 0).toString() }))
          : []
      });
    } else {
      setEditItem(null);
      setFormData({ name: '', price: '', stock: '', variants: [] });
    }
    setIsDialogOpen(true);
  };

  const addVariant = () => {
    setFormData({ ...formData, variants: [...formData.variants, { name: '', price: '', stock: '' }] });
  };

  const updateVariant = (index, field, value) => {
    const newVariants = [...formData.variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setFormData({ ...formData, variants: newVariants });
  };

  const removeVariant = (index) => {
    setFormData({ ...formData, variants: formData.variants.filter((_, i) => i !== index) });
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Please fill in the product name');
      return;
    }

    const variants = formData.variants.filter(v => v.name.trim() && v.price);
    const hasVariants = variants.length > 0;

    if (!hasVariants && !formData.price) {
      toast.error('Please set a base price or add at least one variant');
      return;
    }
    if (!hasVariants && !formData.stock) {
      toast.error('Please set stock quantity');
      return;
    }

    setSaving(true);
    try {
      const parsedVariants = variants.map(v => ({
        name: v.name.trim(),
        price: parseFloat(v.price),
        stock: parseInt(v.stock) || 0
      }));
      const basePrice = hasVariants ? parsedVariants[0].price : parseFloat(formData.price);
      const data = {
        name: formData.name,
        price: basePrice,
        stock: hasVariants ? 0 : parseInt(formData.stock),
        variants: parsedVariants
      };

      if (editItem) {
        await inventoryApi.update(editItem.id, data);
        toast.success('Item updated');
      } else {
        await inventoryApi.create(data);
        toast.success('Item added');
      }
      setIsDialogOpen(false);
      fetchInventory();
    } catch (error) {
      toast.error('Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const confirmMsg = role === 'service'
      ? `Delete "${item.name}"? This action will be logged.`
      : `Delete "${item.name}"?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await inventoryApi.delete(item.id);
      toast.success('Item deleted');
      fetchInventory();
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const getItemTotalStock = (item) => {
    if (item.variants?.length > 0) {
      return item.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
    }
    return item.stock;
  };

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto" data-testid={`${role}-inventory`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Inventory</h1>
            <p className="text-muted-foreground">{inventory.length} items</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="add-item-btn">
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Classic Burger" data-testid="item-name-input" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Layers className="h-4 w-4" /> Variants & Stock
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={addVariant} data-testid="add-variant-btn">
                    <Plus className="h-3 w-3 mr-1" /> Add Variant
                  </Button>
                </div>

                {formData.variants.length === 0 ? (
                  <div className="space-y-3 p-3 rounded-lg border border-dashed">
                    <p className="text-xs text-muted-foreground">No variants — single product with one price & stock.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">Price ($)</Label>
                        <Input type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" data-testid="item-price-input" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Stock</Label>
                        <Input type="number" min="0" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} placeholder="0" data-testid="item-stock-input" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_80px_70px_36px] gap-1.5 px-1 text-xs text-muted-foreground font-medium">
                      <span>Name</span><span>Price</span><span>Stock</span><span></span>
                    </div>
                    {formData.variants.map((variant, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_80px_70px_36px] gap-1.5 items-center" data-testid={`variant-row-${idx}`}>
                        <Input placeholder="Variant name" value={variant.name} onChange={(e) => updateVariant(idx, 'name', e.target.value)} className="h-9" data-testid={`variant-name-${idx}`} />
                        <Input type="number" step="0.01" min="0" placeholder="$" value={variant.price} onChange={(e) => updateVariant(idx, 'price', e.target.value)} className="h-9" data-testid={`variant-price-${idx}`} />
                        <Input type="number" min="0" placeholder="Qty" value={variant.stock} onChange={(e) => updateVariant(idx, 'stock', e.target.value)} className="h-9" data-testid={`variant-stock-${idx}`} />
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeVariant(idx)} data-testid={`remove-variant-${idx}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving} data-testid="save-item-btn">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editItem ? 'Update Item' : 'Add Item'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" data-testid="search-inventory" />
      </div>

      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-2">
          {filteredInventory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No items found</p>
            </div>
          ) : (
            filteredInventory.map((item) => {
              const totalStock = getItemTotalStock(item);
              return (
                <Card key={item.id} data-testid={`inventory-item-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold truncate">{item.name}</h3>
                          {item.variants?.length > 0 && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              <Layers className="h-3 w-3 mr-1" /> {item.variants.length} variants
                            </Badge>
                          )}
                          <span className={`text-xs ${totalStock <= 5 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            {totalStock <= 5 && <AlertTriangle className="h-3 w-3 inline mr-0.5" />}
                            {totalStock} total
                          </span>
                        </div>
                        {item.variants?.length > 0 ? (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                            {item.variants.map((v, i) => (
                              <span key={i} className="text-muted-foreground">
                                {v.name}: {formatCurrency(v.price)}
                                <span className={`ml-1 text-xs ${(v.stock ?? 0) <= 3 ? 'text-destructive' : ''}`}>({v.stock ?? 0})</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm font-medium">{formatCurrency(item.price)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button variant="outline" size="sm" onClick={() => openDialog(item)} data-testid={`edit-item-${item.id}`}>
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(item)} data-testid={`delete-item-${item.id}`}>
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default Inventory;
