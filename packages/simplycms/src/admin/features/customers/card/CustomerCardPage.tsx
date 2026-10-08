import { useParams } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { adminPath } from '../../../lib/adminLinks';
import { CardPageHeader } from '../../catalog-dictionaries/CardPageHeader';
import { NotFoundState } from '../../catalog-dictionaries/PageStates';
import CustomerCategoryCard from './CustomerCategoryCard';
import CustomerContactsForm from './CustomerContactsForm';
import CustomerInfoCard, { customerLabel } from './CustomerInfoCard';
import CustomerRecentOrders from './CustomerRecentOrders';
import CustomerStatsCard from './CustomerStatsCard';
import { useCustomerCard } from './useCustomerCard';

/** Картка покупця `/admin/users/$userId`: перегляд, категорія, контакти. */
export default function CustomerCardPage() {
  const t = useT();
  const { userId } = useParams({ strict: false }) as { userId: string };
  const { data: card, isPending, isError, refetch } = useCustomerCard(userId);
  const back = adminPath('users');

  if (isPending)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  // Збій запиту — не «не знайдено» і не порожні нулі (Е6в F1).
  if (isError)
    return (
      <div role="alert" className="space-y-4 py-12 text-center">
        <p className="text-destructive">{t('admin.users.card.loadError')}</p>
        <Button variant="outline" onClick={() => refetch()}>
          {t('admin.users.card.retry')}
        </Button>
      </div>
    );
  if (card === null)
    return <NotFoundState backTo={back} message={t('admin.users.notFound')} />;

  return (
    <div className="max-w-5xl space-y-6">
      <CardPageHeader backTo={back} title={customerLabel(card)} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <CustomerInfoCard card={card} />
          <CustomerStatsCard card={card} />
          <CustomerRecentOrders userId={card.userId} />
        </div>
        <div className="space-y-6">
          <CustomerCategoryCard card={card} />
          <CustomerContactsForm card={card} />
        </div>
      </div>
    </div>
  );
}
