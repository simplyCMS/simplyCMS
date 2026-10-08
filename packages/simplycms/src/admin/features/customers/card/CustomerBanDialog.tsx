import { useState } from 'react';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'simplycms/ui/dialog';
import { Label } from 'simplycms/ui/label';
import { Textarea } from 'simplycms/ui/textarea';

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (reason: string) => Promise<boolean>;
}

/** Блокування покупця: причина — внутрішня примітка, покупцю не показується. */
export default function CustomerBanDialog({
  open,
  onOpenChange,
  onConfirm,
}: Props) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const submit = async () => {
    setPending(true);
    const ok = await onConfirm(reason.trim());
    setPending(false);
    if (ok) {
      setReason('');
      onOpenChange(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.users.card.banTitle')}</DialogTitle>
          <DialogDescription>
            {t('admin.users.card.banDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="ban-reason">{t('admin.users.card.banReason')}</Label>
          <Textarea
            id="ban-reason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={submit}>
            {t('admin.users.card.banConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
