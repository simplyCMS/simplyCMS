import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { adminPath } from '../lib/adminLinks';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT, type MessageKey } from 'simplycms/i18n';
import { Badge } from 'simplycms/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import { Card, CardContent } from 'simplycms/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { StarRating } from '@simplycms/core/components/reviews/StarRating';
import { Loader2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface ReviewProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface ReviewWithMeta {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  content: string | null;
  images: unknown;
  status: string;
  admin_comment: string | null;
  created_at: string;
  updated_at: string;
  productName: string;
  profile: ReviewProfile | null;
}

// Мапа КЛЮЧІВ: статус відгуку — enum БД.
const statusLabels: Record<string, MessageKey> = {
  pending: 'admin.reviews.status.pending',
  approved: 'admin.reviews.status.approved',
  rejected: 'admin.reviews.status.rejected',
};
const statusVariants: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  approved: 'default',
  rejected: 'destructive',
};

export default function AdminReviews() {
  const t = useT();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-reviews', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('product_reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch product names and profiles
      const productIds = [...new Set((data || []).map((r) => r.product_id))];
      const userIds = [...new Set((data || []).map((r) => r.user_id))];

      const productsMap: Record<string, string> = {};
      const profilesMap: Record<string, ReviewProfile> = {};

      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name')
          .in('id', productIds);
        products?.forEach((p) => {
          productsMap[p.id] = p.name;
        });
      }

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', userIds);
        profiles?.forEach((p) => {
          profilesMap[p.user_id] = p;
        });
      }

      return (data || []).map((r) => ({
        ...r,
        productName: productsMap[r.product_id] || '—',
        profile: profilesMap[r.user_id] || null,
      })) as ReviewWithMeta[];
    },
  });

  const pendingCount = reviews.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" /> {t('admin.nav.reviews')}
            {pendingCount > 0 && (
              <Badge variant="destructive">{pendingCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground">{t('admin.reviews.subtitle')}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('admin.reviews.statusFilter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.reviews.all')}</SelectItem>
            <SelectItem value="pending">
              {t('admin.reviews.status.pending')}
            </SelectItem>
            <SelectItem value="approved">
              {t('admin.reviews.approvedPlural')}
            </SelectItem>
            <SelectItem value="rejected">
              {t('admin.reviews.rejectedPlural')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {t('admin.reviews.empty')}
        </p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.orders.product')}</TableHead>
                  <TableHead>{t('common.author')}</TableHead>
                  <TableHead>{t('admin.reviews.rating')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((r) => {
                  const authorName = r.profile
                    ? [r.profile.first_name, r.profile.last_name]
                        .filter(Boolean)
                        .join(' ') ||
                      r.profile.email ||
                      '—'
                    : '—';
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        navigate({ to: adminPath(`reviews/${r.id}`) })
                      }
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {r.productName}
                      </TableCell>
                      <TableCell>{authorName}</TableCell>
                      <TableCell>
                        <StarRating value={r.rating} readonly size="sm" />
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[r.status] || 'outline'}>
                          {statusLabels[r.status]
                            ? t(statusLabels[r.status])
                            : r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(r.created_at), 'd MMM yyyy HH:mm', {
                          locale: uk,
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
