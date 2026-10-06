import { Loader2, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import { reportTxError } from '../../lib/report-tx-error';
import { StockManagementCard } from './StockManagementCard';
import { StoreProfileForm } from './StoreProfileForm';
import { useSystemSettings } from './useSystemSettings';

/** Сторінка «Налаштування»: профіль магазину та облік залишків (Е6б, Task 6). */
export default function SettingsPage() {
  const t = useT();
  const { query, saveProfile, saveStock } = useSystemSettings();

  if (query.isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (!query.data)
    return (
      <p role="alert" className="p-8 text-center text-destructive">
        {t('admin.settings.loadError')}
      </p>
    );

  const { profile, stockManagement } = query.data;
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <SettingsIcon className="h-8 w-8" />
          {t('admin.nav.settings')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('admin.settings.subtitle')}
        </p>
      </div>
      <StoreProfileForm
        profile={profile}
        onSave={(next) => saveProfile.mutateAsync(next)}
      />
      <StockManagementCard
        decreaseOnOrder={stockManagement.decreaseOnOrder}
        pending={saveStock.isPending}
        onToggle={(next) =>
          saveStock.mutate(next, {
            onSuccess: () => toast.success(t('common.settingsSaved')),
            onError: (e) => reportTxError(t, e),
          })
        }
      />
    </div>
  );
}
