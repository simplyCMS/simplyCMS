import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT } from '@simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import { Badge } from '@simplycms/ui/badge';
import { Switch } from '@simplycms/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@simplycms/ui/table';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import { Plus, Trash2, Globe } from 'lucide-react';
import { adminPath } from '../lib/adminLinks';

export default function ShippingZones() {
  const t = useT();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: zones, isLoading } = useQuery({
    queryKey: ['shipping-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_zones')
        .select(
          `
          *,
          shipping_rates (count)
        `,
        )
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
        .from('shipping_zones')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-zones'] });
      toast.success(t('common.statusUpdated'));
    },
    onError: () => {
      toast.error(t('common.statusUpdateError'));
    },
  });

  const deleteZone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shipping_zones')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-zones'] });
      toast.success(t('admin.shipping.zones.deleted'));
    },
    onError: () => {
      toast.error(t('admin.shipping.zones.deleteFailed'));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.nav.shippingZones')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.shipping.zones.subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link
            to={adminPath('shipping/zones/$zoneId')}
            params={{ zoneId: 'new' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('admin.shipping.zones.add')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.shipping.zones.all')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : !zones?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('admin.shipping.zones.empty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('admin.shipping.zones.cities')}</TableHead>
                  <TableHead className="text-center">
                    {t('admin.shipping.zones.rates')}
                  </TableHead>
                  <TableHead className="text-center">
                    {t('common.activeF')}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('common.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => (
                  <TableRow
                    key={zone.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      navigate({ to: adminPath(`shipping/zones/${zone.id}`) })
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {zone.name}
                            {zone.is_default && (
                              <Badge variant="secondary" className="ml-2">
                                {t('common.byDefault')}
                              </Badge>
                            )}
                          </div>
                          {zone.description && (
                            <div className="text-sm text-muted-foreground">
                              {zone.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {zone.cities && zone.cities.length > 0
                          ? zone.cities.slice(0, 3).join(', ') +
                            (zone.cities.length > 3
                              ? ` +${zone.cities.length - 3}`
                              : '')
                          : '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {zone.shipping_rates?.[0]?.count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={zone.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({
                            id: zone.id,
                            is_active: checked,
                          })
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {!zone.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              confirm(t('admin.shipping.zones.confirmDelete'))
                            ) {
                              deleteZone.mutate(zone.id);
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
