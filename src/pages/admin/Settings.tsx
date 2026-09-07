import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Settings as SettingsIcon, Package } from "lucide-react";

interface StockManagementSettings {
  decrease_on_order: boolean;
}

interface SystemSetting {
  id: string;
  key: string;
  value: StockManagementSettings;
  description: string | null;
}

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: stockSettings, isLoading } = useQuery({
    queryKey: ["system-settings", "stock_management"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .eq("key", "stock_management")
        .single();
      if (error) throw error;
      return data as unknown as SystemSetting;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (newValue: StockManagementSettings) => {
      const { error } = await supabase
        .from("system_settings")
        .update({ value: newValue as any })
        .eq("key", "stock_management");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Налаштування збережено");
    },
    onError: (error: Error) => {
      toast.error(`Помилка: ${error.message}`);
    },
  });

  const handleToggleDecreaseOnOrder = (checked: boolean) => {
    const currentValue = stockSettings?.value || { decrease_on_order: false };
    updateMutation.mutate({ ...currentValue, decrease_on_order: checked });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const decreaseOnOrder = stockSettings?.value?.decrease_on_order ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <SettingsIcon className="h-8 w-8" />
          Налаштування
        </h1>
        <p className="text-muted-foreground mt-1">
          Загальні налаштування системи
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Управління залишками</CardTitle>
              <CardDescription>
                Налаштування автоматичного обліку залишків товарів
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="decrease_on_order" className="text-base">
                Зменшувати залишки при оформленні замовлення
              </Label>
              <p className="text-sm text-muted-foreground">
                Коли увімкнено, система автоматично зменшує кількість товару на
                складі при створенні нового замовлення
              </p>
            </div>
            <Switch
              id="decrease_on_order"
              checked={decreaseOnOrder}
              onCheckedChange={handleToggleDecreaseOnOrder}
              disabled={updateMutation.isPending}
            />
          </div>

          <Separator />

          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Як це працює:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                • При <strong>увімкненій</strong> опції: коли клієнт оформлює
                замовлення, залишки автоматично зменшуються на вказану кількість
              </li>
              <li>
                • При <strong>вимкненій</strong> опції: залишки не змінюються
                автоматично, адміністратор керує ними вручну
              </li>
              <li>
                • Залишки зменшуються з того складу, який вказаний у замовленні
                (точка самовивозу), або з першого доступного
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
