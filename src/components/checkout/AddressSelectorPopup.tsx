import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MapPin, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Address {
  id: string;
  name: string;
  city: string;
  address: string;
  is_default: boolean;
}

interface AddressSelectorPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addresses: Address[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddNew: () => void;
}

type SortOption = "default" | "name" | "city";

export function AddressSelectorPopup({
  open,
  onOpenChange,
  addresses,
  selectedId,
  onSelect,
  onAddNew,
}: AddressSelectorPopupProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");

  const filteredAddresses = useMemo(() => {
    let result = [...addresses];

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(searchLower) ||
          a.city.toLowerCase().includes(searchLower) ||
          a.address.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    switch (sortBy) {
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "city":
        result.sort((a, b) => a.city.localeCompare(b.city));
        break;
      case "default":
      default:
        result.sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
        break;
    }

    return result;
  }, [addresses, search, sortBy]);

  const handleSelect = (id: string) => {
    onSelect(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Оберіть адресу доставки</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Пошук за назвою, містом, адресою..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">За замовч.</SelectItem>
              <SelectItem value="name">За назвою</SelectItem>
              <SelectItem value="city">За містом</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {filteredAddresses.map((addr) => (
              <button
                key={addr.id}
                type="button"
                onClick={() => handleSelect(addr.id)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all",
                  "hover:border-primary/50 hover:bg-accent/50",
                  selectedId === addr.id
                    ? "border-primary bg-primary/5"
                    : "border-muted bg-card"
                )}
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{addr.name}</span>
                    {addr.is_default && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        За замовч.
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">м. {addr.city}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {addr.address}
                  </p>
                </div>
                {selectedId === addr.id && (
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}

            {filteredAddresses.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {search ? "Нічого не знайдено" : "Немає збережених адрес"}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Скасувати
          </Button>
          <Button variant="secondary" onClick={onAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Нова адреса
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
