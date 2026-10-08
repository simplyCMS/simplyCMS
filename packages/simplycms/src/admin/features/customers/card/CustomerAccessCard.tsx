import { useState } from 'react';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import { useT } from 'simplycms/i18n';
import type { AdminCustomerCard } from 'simplycms/contracts/objects';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Label } from 'simplycms/ui/label';
import { Switch } from 'simplycms/ui/switch';
import CustomerBanDialog from './CustomerBanDialog';
import CustomerDeleteDialog from './CustomerDeleteDialog';
import { useCustomerAccess } from './useCustomerAccess';
import { useFormatDate } from './useFormatDate';

/** Доступ: роль адміна, блокування й видалення акаунта. */
export default function CustomerAccessCard({
  card,
}: {
  readonly card: AdminCustomerCard;
}) {
  const t = useT();
  const formatDate = useFormatDate();
  const { user } = useAuth();
  const { changeRole, changeBan } = useCustomerAccess(card.userId);
  const [banOpen, setBanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isSelf = user?.id === card.userId;
  const banned = card.bannedAt !== null;
  // Сервер відмовляє так само (409), блокуємо лише зайвий клік.
  const hint = isSelf
    ? t('admin.users.card.roleSelfHint')
    : banned
      ? t('admin.errors.adminRoleBanned')
      : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.users.card.access')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {banned && card.bannedAt && (
          <div
            role="status"
            className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 p-3 text-sm"
          >
            <div>
              <div className="font-medium">
                {t('admin.users.card.bannedSince', {
                  date: formatDate(card.bannedAt),
                })}
              </div>
              {card.banReason && (
                <div className="text-muted-foreground">{card.banReason}</div>
              )}
            </div>
            <Button variant="outline" onClick={() => changeBan(false)}>
              {t('admin.users.card.unban')}
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Switch
            id="access-admin"
            checked={card.isAdmin}
            disabled={isSelf || banned}
            onCheckedChange={(v) => changeRole(v)}
          />
          <Label htmlFor="access-admin">{t('admin.users.adminAccess')}</Label>
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {card.isAdmin ? (
          <p className="text-xs text-muted-foreground">
            {t('admin.errors.customerIsAdmin')}
          </p>
        ) : (
          <div className="flex gap-2">
            {!banned && (
              <Button variant="outline" onClick={() => setBanOpen(true)}>
                {t('admin.users.card.ban')}
              </Button>
            )}
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              {t('admin.users.card.delete')}
            </Button>
          </div>
        )}
      </CardContent>
      <CustomerBanDialog
        open={banOpen}
        onOpenChange={setBanOpen}
        onConfirm={(reason) => changeBan(true, reason)}
      />
      <CustomerDeleteDialog
        userId={card.userId}
        email={card.email}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </Card>
  );
}
