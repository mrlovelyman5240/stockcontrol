import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Truck, User } from 'lucide-react';

const DriverSelect = ({ drivers, value, onChange }) => {
  return (
    <div>
      <Label className="flex items-center gap-1 mb-1.5 text-xs font-medium text-muted-foreground">
        <Truck className="h-3 w-3" />
        Driver <span className="text-destructive">*</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
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
  );
};

export default DriverSelect;
