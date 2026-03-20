import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { inventoryApi } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';
import { 
  Package, 
  Plus, 
  Pencil, 
  Trash2, 
  Search,
  Loader2,
  AlertTriangle
} from 'lucide-react';

const ServiceInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: ''
  });
  const [saving, setSaving] = useState(false);

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

  const openDialog = (item = null) => {
    if (item) {
      setEditItem(item);
      setFormData({
        name: item.name,
        price: item.price.toString(),
        stock: item.stock.toString()
      });
    } else {
      setEditItem(null);
      setFormData({
        name: '',
        price: '',
        stock: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.stock) {
      toast.error('Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: formData.name,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock)
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
    if (!window.confirm(`Delete "${item.name}"? This action will be logged.`)) return;
    
    try {
      await inventoryApi.delete(item.id);
      toast.success('Item deleted');
      fetchInventory();
    } catch (error) {
      toast.error('Failed to delete item');
    }
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
    <div className="p-4 max-w-2xl mx-auto" data-testid="service-inventory">
      {/* Header */}
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
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Product name"
                  data-testid="item-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    data-testid="item-price-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                    data-testid="item-stock-input"
                  />
                </div>
              </div>
              <Button 
                className="w-full" 
                onClick={handleSave} 
                disabled={saving}
                data-testid="save-item-btn"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editItem ? 'Update Item' : 'Add Item'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="search-inventory"
        />
      </div>

      {/* Inventory List */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-2">
          {filteredInventory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No items found</p>
            </div>
          ) : (
            filteredInventory.map((item) => (
              <Card key={item.id} data-testid={`inventory-item-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{item.name}</h3>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium">{formatCurrency(item.price)}</span>
                        <span className={`${item.stock <= 5 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {item.stock <= 5 && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                          {item.stock} in stock
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog(item)}
                        data-testid={`edit-item-${item.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(item)}
                        data-testid={`delete-item-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ServiceInventory;
