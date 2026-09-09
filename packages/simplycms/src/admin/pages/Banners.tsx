import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent } from 'simplycms/ui/card';
import { Switch } from 'simplycms/ui/switch';
import { Badge } from 'simplycms/ui/badge';
import { Skeleton } from 'simplycms/ui/skeleton';
import { useToast } from 'simplycms/core/hooks/use-toast';
import {
  Plus,
  Trash2,
  GripVertical,
  ImageIcon,
  Clock,
  Calendar,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { adminPath } from '../lib/adminLinks';
import { useT, type MessageKey } from 'simplycms/i18n';

// Мапа КЛЮЧІВ: код розміщення приходить із БД.
const PLACEMENT_LABELS: Record<string, MessageKey> = {
  home: 'admin.banners.placement.home',
  catalog: 'admin.banners.placement.catalog',
  section: 'admin.banners.placement.section',
  blog: 'admin.banners.placement.blog',
  global: 'admin.banners.placement.global',
};

export default function Banners() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: banners, isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('banners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      toast({ title: t('admin.banners.deleted') });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from('banners')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const hasSchedule = (b: {
    date_from: string | null;
    date_to: string | null;
    schedule_days: unknown;
    schedule_time_from: string | null;
  }) =>
    b.date_from ||
    b.date_to ||
    (Array.isArray(b.schedule_days) && b.schedule_days.length > 0) ||
    b.schedule_time_from;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.nav.banners')}</h1>
        <Button
          onClick={() =>
            navigate({
              to: adminPath('banners/$bannerId'),
              params: { bannerId: 'new' },
            })
          }
        >
          <Plus className="h-4 w-4 mr-2" /> {t('admin.banners.add')}
        </Button>
      </div>

      {!banners?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ImageIcon
              className="h-12 w-12 mx-auto mb-4 opacity-30"
              aria-hidden="true"
            />
            <p>{t('admin.banners.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <Card
              key={b.id}
              className="overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate({ to: adminPath(`banners/${b.id}`) })}
            >
              <div className="flex items-center gap-4 p-4">
                <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="relative h-16 w-28 rounded bg-muted overflow-hidden shrink-0">
                  <img
                    src={b.image_url}
                    alt={b.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">{b.title}</p>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {PLACEMENT_LABELS[b.placement]
                        ? t(PLACEMENT_LABELS[b.placement])
                        : b.placement}
                    </Badge>
                    {hasSchedule(b) && (
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  {b.subtitle && (
                    <p className="text-xs text-muted-foreground truncate">
                      {b.subtitle}
                    </p>
                  )}
                  {(b.date_from || b.date_to) && (
                    <div className="flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {b.date_from
                          ? new Date(b.date_from).toLocaleDateString('uk')
                          : '...'}{' '}
                        —{' '}
                        {b.date_to
                          ? new Date(b.date_to).toLocaleDateString('uk')
                          : '...'}
                      </span>
                    </div>
                  )}
                </div>
                <Switch
                  checked={b.is_active}
                  onCheckedChange={(checked) =>
                    toggleActive.mutate({ id: b.id, is_active: checked })
                  }
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(b.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
