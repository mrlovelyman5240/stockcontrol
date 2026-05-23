import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { formatCurrency } from '../../../lib/utils';
import { ShoppingCart, Plus, Minus, Trash2, Gift, Loader2, Check } from 'lucide-react';

const Cart = ({
  cart,
  selectedGiftOption,
  onUpdateQuantity,
  onRemove,
  onSubmit,
  submitting,
  canSubmit,
}) => {
  if (cart.length === 0) return null;

  const paidItems = cart.filter(c => !c.is_free_gift);
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <Card className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto shadow-xl border-t z-50" data-testid="cart-summary">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Cart ({paidItems.reduce((s, i) => s + i.quantity, 0)})
          </span>
          <span className="text-primary font-bold">{formatCurrency(total)}</span>
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
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onUpdateQuantity(index, -1); }}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onUpdateQuantity(index, 1); }}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(index); }}>
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
          onClick={onSubmit}
          disabled={submitting || !canSubmit}
          data-testid="submit-order"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Check className="h-5 w-5 mr-2" />
          )}
          Place Order — {formatCurrency(total)}
        </Button>
      </CardContent>
    </Card>
  );
};

export default Cart;
