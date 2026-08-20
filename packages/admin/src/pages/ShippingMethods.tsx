import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT, type Translator } from 'simplycms/i18n';
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
import { Plus, Trash2, Truck } from 'lucide-react';
import { adminPath } from '../lib/adminLinks';
import { ShippingMethod } from '@simplycms/core/lib/shipping/types';
import { icons } from 'lucide-react';

const getMethodIcon = (
  iconName: string | null,
): React.ComponentType<{ className?: string }> => {
  if (!iconName) return Truck;
  const Icon = icons[iconName as keyof typeof icons];
  return Icon || Truck;
};

// Транслятор параметром: хелпер живе на рівні модуля, тож хуком його взяти
// не може — його передає компонент.
const methodTypeBadge = (t: Translator, type: string) => {
  switch (type) {
    case 'system':
      return <Badge variant="secondary">{t('common.system')}</Badge>;
    case 'manual':
      return (
        <Badge variant="outline">{t('admin.shipping.source.manual')}</Badge>
      );
    case 'plugin':
      return (
        <Badge className="bg-purple-500">
          {t('admin.shipping.source.plugin')}
        </Badge>
      );
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
};

export default function ShippingMethods() {
  const t = useT();
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: methods, isLoading } = useQuery({
    queryKey: ['shipping-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_methods')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as unknown as ShippingMethod[];
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
        .from('shipping_methods')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-methods'] });
      toast.success(t('common.statusUpdated'));
    },
    onError: () => {
      toast.error(t('common.statusUpdateError'));
    },
  });

  const deleteMethod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shipping_methods')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-methods'] });
      toast.success(t('admin.shipping.methods.deleted'));
    },
    onError: () => {
      toast.error(t('admin.shipping.methods.deleteFailed'));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {t('admin.nav.shippingMethods')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('admin.shipping.methods.subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link
            to={adminPath('shipping/methods/$methodId')}
            params={{ methodId: 'new' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('admin.shipping.methods.add')}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.shipping.methods.all')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : !methods?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('admin.shipping.methods.empty')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('common.code')}</TableHead>
                  <TableHead>{t('common.type')}</TableHead>
                  <TableHead className="text-center">
                    {t('common.activeF')}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('common.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map((method) => {
                  const IconComponent = getMethodIcon(method.icon);
                  return (
                    <TableRow
                      key={method.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        navigate({
                          to: adminPath(`shipping/methods/${method.id}`),
                        })
                      }
                    >
                      <TableCell>
                        <IconComponent className="h-5 w-5 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{method.name}</div>
                          {method.description && (
                            <div className="text-sm text-muted-foreground">
                              {method.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {method.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        {methodTypeBadge(t, method.type)}
                        {method.plugin_name && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({method.plugin_name})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={method.is_active}
                          onCheckedChange={(checked) =>
                            toggleActive.mutate({
                              id: method.id,
                              is_active: checked,
                            })
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {method.type !== 'system' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  t('admin.shipping.methods.confirmDelete'),
                                )
                              ) {
                                deleteMethod.mutate(method.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
