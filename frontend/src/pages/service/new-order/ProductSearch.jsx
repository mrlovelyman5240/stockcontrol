import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { formatCurrency } from '../../../lib/utils';
import { AlertTriangle, Search, Layers, ChevronRight } from 'lucide-react';

const ProductSearch = ({ inventory, search, onSearchChange, onProductClick, getRemaining }) => {
  const filtered = inventory.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-10"
          data-testid="search-products"
        />
      </div>

      <ScrollArea className="h-[220px] mb-4 border rounded-xl">
        <div className="divide-y">
          {filtered.map((item) => {
            const totalStock = getRemaining(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onProductClick(item)}
                disabled={totalStock <= 0}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                  totalStock <= 0
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
                    <span className={`text-xs ${totalStock <= 5 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {totalStock <= 0 ? (
                        <span className="flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> Out</span>
                      ) : `${totalStock} left`}
                    </span>
                  </div>
                </div>
                {totalStock > 0 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">No products found</div>
          )}
        </div>
      </ScrollArea>
    </>
  );
};

export default ProductSearch;
