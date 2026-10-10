import { useState } from 'react';
import { Check, Trash2, Undo2, X } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import type {
  AdminReviewCard,
  ReviewStatus,
} from 'simplycms/contracts/objects';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'simplycms/ui/alert-dialog';
import { Button } from 'simplycms/ui/button';
import { Label } from 'simplycms/ui/label';
import { Textarea } from 'simplycms/ui/textarea';
import { useSetReviewsStatus } from '../useSetReviewsStatus';
import { useDeleteReview } from './useDeleteReview';

/** Внутрішня примітка й дії модерації картки (статус, видалення). */
export default function ReviewModeration({
  review,
}: {
  readonly review: AdminReviewCard;
}) {
  const t = useT();
  const [note, setNote] = useState(review.adminComment ?? '');
  const [busy, setBusy] = useState(false);
  const setStatuses = useSetReviewsStatus();
  const remove = useDeleteReview(review.id);
  const apply = async (status: ReviewStatus) => {
    setBusy(true);
    await setStatuses([review.id], status, note.trim() === '' ? null : note);
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="review-note">{t('admin.reviews.internalNote')}</Label>
        <Textarea
          id="review-note"
          value={note}
          maxLength={2000}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {review.status !== 'approved' && (
          <Button disabled={busy} onClick={() => apply('approved')}>
            <Check className="mr-2 h-4 w-4" />
            {t('admin.reviews.approve')}
          </Button>
        )}
        {review.status !== 'rejected' && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => apply('rejected')}
          >
            <X className="mr-2 h-4 w-4" />
            {t('admin.reviews.reject')}
          </Button>
        )}
        {review.status !== 'pending' && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => apply('pending')}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            {t('admin.reviews.backToPending')}
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={busy}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t('common.delete')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('admin.reviews.deleteTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin.reviews.deleteText')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <Button variant="destructive" onClick={remove}>
                {t('common.delete')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
