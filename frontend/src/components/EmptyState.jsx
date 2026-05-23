import { cn } from "../lib/utils";

/**
 * Reusable empty-state. Shows a circular icon, headline, optional body,
 * and an optional CTA. Pass any lucide-react icon component as `icon`.
 *
 * <EmptyState
 *   icon={Package}
 *   title="No products yet"
 *   description="Add your first product to start taking orders."
 *   action={<Button onClick={openCreate}>New product</Button>}
 * />
 */
const EmptyState = ({ icon: Icon, title, description, action, className }) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-12",
        className,
      )}
      data-testid="empty-state"
    >
      {Icon && (
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4 ring-1 ring-border">
          <Icon className="h-7 w-7 text-muted-foreground" aria-hidden />
        </div>
      )}
      {title && <h3 className="text-base font-semibold mb-1">{title}</h3>}
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs mb-4">{description}</p>
      )}
      {action}
    </div>
  );
};

export default EmptyState;
