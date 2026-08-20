import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT } from 'simplycms/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@simplycms/ui/card';
import { Switch } from '@simplycms/ui/switch';
import { Label } from '@simplycms/ui/label';
import { Separator } from '@simplycms/ui/separator';
import { toast } from 'sonner';
import { Loader2, Settings as SettingsIcon, Package } from 'lucide-react';
import type { Json } from 'simplycms/supabase';

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
  const t = useT();
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  const { data: stockSettings, isLoading } = useQuery({
    queryKey: ['system-settings', 'stock_management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'stock_management')
        .single();
      if (error) throw error;
      return data as unknown as SystemSetting;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (newValue: StockManagementSettings) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: newValue as unknown as Json })
        .eq('key', 'stock_management');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success(t('common.settingsSaved'));
    },
    onError: (error: Error) => {
      toast.error(t('common.errorWithMessage', { message: error.message }));
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
          {t('admin.nav.settings')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('admin.settings.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{t('admin.settings.stock')}</CardTitle>
              <CardDescription>{t('admin.settings.stockHint')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="decrease_on_order" className="text-base">
                {t('admin.settings.decreaseStock')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('admin.settings.decreaseStockHint')}
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
            <h4 className="font-medium mb-2">{t('common.howItWorks')}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {/* 🔴 Жирне виділення «увімкненій/вимкненій» знято навмисно:
                  розрізати речення на три ключі заради <strong> зробило б
                  переклад крихким. Пункт лишається одним ключем. */}
              <li>{t('admin.settings.enabledCase')}</li>
              <li>{t('admin.settings.disabledCase')}</li>
              <li>{t('admin.settings.warehouseNote')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
