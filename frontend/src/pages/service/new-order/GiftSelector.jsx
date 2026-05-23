import { useState } from 'react';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { Gift, Search, Check, ChevronRight, ChevronsUpDown } from 'lucide-react';

const getProductTotalStock = (item) => {
  if (item.variants?.length > 0) return item.variants.reduce((s, v) => s + (v.stock ?? 0), 0);
  return item.stock;
};

const GiftSelector = ({ inventory, freeGiftId, selectedGiftOption, onSelect, onClear }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedProduct, setExpandedProduct] = useState(null);

  const closeAndReset = (newOpen) => {
    setOpen(newOpen);
    if (!newOpen) {
      setExpandedProduct(null);
      setSearch('');
    }
  };

  const handleSelect = (itemId, variantName) => {
    onSelect(itemId, variantName);
    setOpen(false);
    setExpandedProduct(null);
    setSearch('');
  };

  const handleClear = () => {
    onClear();
    setOpen(false);
    setExpandedProduct(null);
    setSearch('');
  };

  const giftProducts = inventory.filter(item => {
    const totalStock = getProductTotalStock(item);
    if (totalStock <= 0) return false;
    if (!search) return true;
    return item.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <Label className="flex items-center gap-1 mb-1.5 text-xs font-medium text-muted-foreground">
        <Gift className="h-3 w-3" />
        Free Gift
      </Label>
      <Popover open={open} onOpenChange={closeAndReset}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full h-10 justify-between font-normal text-left"
            data-testid="free-gift-select"
          >
            <span className="truncate text-sm">
              {selectedGiftOption ? selectedGiftOption.label : 'None'}
            </span>
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setExpandedProduct(null); }}
                className="h-8 pl-8 text-sm"
                data-testid="gift-search-input"
              />
            </div>
          </div>
          <ScrollArea className="max-h-[240px]">
            <button
              type="button"
              onClick={handleClear}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-muted-foreground"
              data-testid="gift-option-none"
            >
              <Check className={`h-3.5 w-3.5 shrink-0 ${!freeGiftId ? 'opacity-100' : 'opacity-0'}`} />
              No free gift
            </button>
            <div className="border-t" />
            {giftProducts.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">No products found</div>
            )}
            {giftProducts.map((item) => {
              const hasVariants = item.variants?.length > 0;
              const isExpanded = expandedProduct === item.id;
              const isSelectedProduct = selectedGiftOption?.item_id === item.id;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (hasVariants) {
                        setExpandedProduct(isExpanded ? null : item.id);
                      } else {
                        handleSelect(item.id, null);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                      isExpanded ? 'bg-muted/80' : 'hover:bg-muted/60'
                    }`}
                    data-testid={`gift-product-${item.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {!hasVariants && (
                        <Check className={`h-3.5 w-3.5 shrink-0 ${isSelectedProduct && !selectedGiftOption?.variant_name ? 'opacity-100' : 'opacity-0'}`} />
                      )}
                      {hasVariants && (
                        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      )}
                      <span className="truncate font-medium">{item.name}</span>
                    </div>
                    {hasVariants && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 ml-1">
                        {item.variants.length}
                      </Badge>
                    )}
                    {!hasVariants && (
                      <span className="text-xs text-muted-foreground shrink-0 ml-1">{item.stock} left</span>
                    )}
                  </button>
                  {hasVariants && isExpanded && (
                    <div className="bg-muted/40 border-t border-b">
                      {item.variants.map((v, vIdx) => {
                        const vStock = v.stock ?? 0;
                        const isOutOfStock = vStock <= 0;
                        const isSelected = freeGiftId === `${item.id}:::${v.name}`;
                        return (
                          <button
                            key={vIdx}
                            type="button"
                            onClick={() => !isOutOfStock && handleSelect(item.id, v.name)}
                            disabled={isOutOfStock}
                            className={`w-full flex items-center justify-between pl-8 pr-3 py-1.5 text-sm transition-colors ${
                              isOutOfStock
                                ? 'opacity-35 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-primary/10 text-primary'
                                  : 'hover:bg-muted/80'
                            }`}
                            data-testid={`gift-variant-${item.id}-${v.name}`}
                          >
                            <div className="flex items-center gap-2">
                              <Check className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                              <span>{v.name}</span>
                            </div>
                            <span className={`text-xs ${isOutOfStock ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {isOutOfStock ? 'Out' : `${vStock} left`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default GiftSelector;
