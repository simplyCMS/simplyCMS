import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { useT } from '@simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import { Button } from '@simplycms/ui/button';
import { Truck, MapPin, Map, Building, ArrowRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Skeleton } from '@simplycms/ui/skeleton';
import { adminPath } from '../lib/adminLinks';

export default function Shipping() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { data: methods, isLoading: methodsLoading } = useQuery({
    queryKey: ['shipping-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_methods')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: zones, isLoading: zonesLoading } = useQuery({
    queryKey: ['shipping-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_zones')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: pickupPoints, isLoading: pointsLoading } = useQuery({
    queryKey: ['pickup-points'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pickup_points')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const activeMethods = methods?.filter((m) => m.is_active).length || 0;
  const activeZones = zones?.filter((z) => z.is_active).length || 0;
  const activePoints = pickupPoints?.filter((p) => p.is_active).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('cart.summary.shipping')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('admin.shipping.subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.nav.shippingMethods')}
            </CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {methodsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{activeMethods}</div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.shipping.activeOf')} {methods?.length || 0}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.nav.shippingZones')}
            </CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {zonesLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{activeZones}</div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.shipping.activeOf')} {zones?.length || 0}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('admin.nav.pickupPoints')}
            </CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {pointsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{activePoints}</div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.shipping.activeOf')} {pickupPoints?.length || 0}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link to={adminPath('shipping/methods')}>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {t('admin.nav.shippingMethods')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('admin.shipping.methodsHint')}
              </p>
              <Button variant="ghost" size="sm" className="gap-1">
                {t('admin.shipping.go')} <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link to={adminPath('shipping/zones')}>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Map className="h-5 w-5" />
                {t('admin.nav.shippingZones')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('admin.shipping.zonesHint')}
              </p>
              <Button variant="ghost" size="sm" className="gap-1">
                {t('admin.shipping.go')} <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link to={adminPath('shipping/pickup-points')}>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5" />
                {t('admin.nav.pickupPoints')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('admin.shipping.pointsHint')}
              </p>
              <Button variant="ghost" size="sm" className="gap-1">
                {t('admin.shipping.go')} <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link to=".">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t('admin.shipping.locations')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('admin.shipping.locationsHint')}
              </p>
              <Button variant="ghost" size="sm" className="gap-1">
                {t('admin.shipping.go')} <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
