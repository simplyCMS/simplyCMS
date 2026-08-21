import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Badge } from 'simplycms/ui/badge';
import { Switch } from 'simplycms/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import { Plus, Trash2, Building, Shield } from 'lucide-react';
import { adminPath } from '../lib/adminLinks';

export default function PickupPoints() {
  const t = useT();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: points, isLoading } = useQuery({
    queryKey: ['pickup-points'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pickup_points')
        .select(`*, zone:shipping_zones(name)`)
        .order('sort_order');
      if (error) throw error;
      return data;
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
        .from('pickup_points')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickup-points'] });
      toast.success(t('common.statusUpdated'));
    },
    onError: () => {
      toast.error(t('common.statusUpdateError'));
    },
  });

  const deletePoint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pickup_points')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickup-points'] });
      toast.success(t('admin.shipping.points.deleted'));
    },
    onError: () => {
      toast.error(t('admin.shipping.points.deleteFailed'));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.nav.pickupPoints')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.shipping.points.subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link
            to={adminPath('shipping/pickup-points/$pointId')}
            params={{ pointId: 'new' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('admin.shipping.points.add')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.shipping.points.all')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : !points?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('admin.shipping.points.empty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('common.city')}</TableHead>
                  <TableHead>{t('common.address')}</TableHead>
                  <TableHead>{t('admin.shipping.points.zone')}</TableHead>
                  <TableHead className="text-center">
                    {t('common.activeF')}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('common.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((point) => (
                  <TableRow
                    key={point.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      navigate({
                        to: adminPath(`shipping/pickup-points/${point.id}`),
                      })
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <div className="font-medium">{point.name}</div>
                        {point.is_system && (
                          <Badge variant="secondary" className="gap-1">
                            <Shield className="h-3 w-3" />
                            {t('admin.shipping.points.system')}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{point.city}</TableCell>
                    <TableCell>
                      <div className="max-w-50 truncate" title={point.address}>
                        {point.address}
                      </div>
                    </TableCell>
                    <TableCell>
                      {point.zone?.name ? (
                        <Badge variant="outline">{point.zone.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={point.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({
                            id: point.id,
                            is_active: checked,
                          })
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {!point.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              confirm(t('admin.shipping.points.confirmDelete'))
                            ) {
                              deletePoint.mutate(point.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
