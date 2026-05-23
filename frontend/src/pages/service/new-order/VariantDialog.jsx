import { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { formatCurrency } from '../../../lib/utils';
import { Plus } from 'lucide-react';

const VariantDialog = ({ open, product, onOpenChange, onAddToCart, getRemaining }) => {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [customPrice, setCustomPrice] = useState('');

  useEffect(() => {
    if (!product) {
      setSelectedVariant(null);
      setCustomPrice('');
      return;
    }
    if (product.variants?.length > 0) {
      setSelectedVariant(null);
      setCustomPrice('');
    } else {
      setSelectedVariant(null);
      setCustomPrice(product.price.toString());
    }
  }, [product]);

  const handleVariantSelect = (variant) => {
    setSelectedVariant(variant);
    setCustomPrice(variant.price.toString());
  };

  const handleAdd = () => {
    const price = parseFloat(customPrice);
    if (isNaN(price) || price < 0) {
      return;
    }
    onAddToCart({ product, variant: selectedVariant, price });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">{product?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {product?.variants?.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Select Variant</Label>
              <div className="grid grid-cols-1 gap-2">
                {product.variants.map((v, idx) => {
                  const rawUp = v.units_per;
                  const unitsPerValid = rawUp === undefined || rawUp === null
                    ? true
                    : Number.isInteger(rawUp) && rawUp >= 1;
                  const unitsPer = unitsPerValid ? (rawUp ?? 1) : 1;
                  const remaining = getRemaining ? getRemaining(product.id) : (product.stock ?? 0);
                  const variantStock = unitsPerValid ? Math.floor(remaining / unitsPer) : 0;
                  const isOutOfStock = !unitsPerValid || variantStock <= 0;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => !isOutOfStock && handleVariantSelect(v)}
                      disabled={isOutOfStock}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${
                        isOutOfStock
                          ? 'opacity-40 cursor-not-allowed border-border bg-muted/30'
                          : selectedVariant?.name === v.name
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/40'
                      }`}
                      data-testid={`variant-option-${idx}`}
                    >
                      <div>
                        <span className="font-medium text-sm">{v.name}</span>
                        <span className={`ml-2 text-xs ${isOutOfStock ? 'text-destructive' : variantStock <= 5 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {!unitsPerValid ? 'Data error' : isOutOfStock ? 'Out of stock' : `${variantStock} left`}
                        </span>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency(v.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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

          <Button
            className="w-full h-11"
            onClick={handleAdd}
            disabled={!customPrice || (product?.variants?.length > 0 && !selectedVariant)}
            data-testid="add-to-cart-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add to Cart — {customPrice ? formatCurrency(parseFloat(customPrice) || 0) : '$0.00'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VariantDialog;
