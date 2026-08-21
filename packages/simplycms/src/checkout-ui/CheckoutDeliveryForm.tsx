import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, ChevronRight, Save, icons } from 'lucide-react';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import type {
  ShippingMethod,
  ShippingRate,
  PickupPoint,
} from 'simplycms/domain/shipping';
import { formatShippingCost } from 'simplycms/domain/shipping';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import { useToast } from 'simplycms/ui/use-toast';
import { useT } from 'simplycms/i18n';
import { useEngine } from 'simplycms/react-query';
import { AddressCard } from './AddressCard';
import { AddressSelectorPopup } from './AddressSelectorPopup';
import { AddressSaveDialog } from './AddressSaveDialog';

interface CheckoutDeliveryFormProps {
  values: Record<string, string | boolean>;
  onChange: (field: string, value: string | boolean) => void;
  subtotal: number;
  onShippingCostChange: (cost: number) => void;
}

interface SavedAddress {
  id: string;
  name: string;
  city: string;
  address: string;
  is_default: boolean;
}

const MAX_VISIBLE_CARDS = 3;

const getMethodIcon = (
  iconName: string | null,
): React.ComponentType<{ className?: string }> => {
  if (!iconName) return Truck;
  const Icon = icons[iconName as keyof typeof icons];
  return (Icon as React.ComponentType<{ className?: string }>) || Truck;
};

export function CheckoutDeliveryForm({
  values,
  onChange,
  subtotal,
  onShippingCostChange,
}: CheckoutDeliveryFormProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useT();
  // Локаль і валюта для `formatShippingCost` — чистої T1-функції без доступу
  // ні до конфігу магазину, ні до перекладів (див. коментар у shipping.ts).
  const { config } = useEngine();
  const queryClient = useQueryClient();
  const selectedMethodId = values.shippingMethodId as string | undefined;
  const selectedAddressId = values.savedAddressId as string | undefined;

  const [popupOpen, setPopupOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [originalAddress, setOriginalAddress] = useState<SavedAddress | null>(
    null,
  );

  const { data: methods, isLoading: methodsLoading } = useQuery({
    queryKey: ['checkout-shipping-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_methods')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as unknown as ShippingMethod[];
    },
  });

  const { data: rates } = useQuery({
    queryKey: ['checkout-shipping-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_rates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as unknown as ShippingRate[];
    },
  });

  const { data: pickupPoints } = useQuery({
    queryKey: ['checkout-pickup-points'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pickup_points')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as unknown as PickupPoint[];
    },
  });

  const { data: savedAddresses } = useQuery({
    queryKey: ['checkout-saved-addresses', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SavedAddress[];
    },
    enabled: !!user,
  });

  const visibleAddresses = useMemo(() => {
    if (!savedAddresses) return [];
    return savedAddresses.slice(0, MAX_VISIBLE_CARDS);
  }, [savedAddresses]);

  const showMoreButton =
    savedAddresses && savedAddresses.length > MAX_VISIBLE_CARDS;
  const selectedMethod = methods?.find((m) => m.id === selectedMethodId);
  const isPickup = selectedMethod?.code === 'pickup';
  const showAddressFields = selectedMethod && !isPickup;

  const currentCity = String(values.deliveryCity || '');
  const currentAddress = String(values.deliveryAddress || '');

  // hasChanges — виведений стан, не потребує окремого useState
  const hasChanges = useMemo(() => {
    if (!originalAddress) return false;
    return (
      currentCity !== originalAddress.city ||
      currentAddress !== originalAddress.address
    );
  }, [currentCity, currentAddress, originalAddress]);

  const handleSelectAddress = (addressId: string) => {
    if (selectedAddressId === addressId) {
      onChange('savedAddressId', '');
      setOriginalAddress(null);
      onChange('deliveryCity', '');
      onChange('deliveryAddress', '');
      return;
    }
    const address = savedAddresses?.find((a) => a.id === addressId);
    if (address) {
      onChange('savedAddressId', addressId);
      setOriginalAddress(address);
      onChange('deliveryCity', address.city);
      onChange('deliveryAddress', address.address);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!originalAddress) return;
      const { error } = await supabase
        .from('user_addresses')
        .update({ city: currentCity, address: currentAddress })
        .eq('id', originalAddress.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkout-saved-addresses'] });
      toast({ title: t('common.address.updated') });
      setOriginalAddress({
        ...originalAddress!,
        city: currentCity,
        address: currentAddress,
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('user_addresses')
        .insert({
          user_id: user.id,
          name: t('common.address.new'),
          city: currentCity,
          address: currentAddress,
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checkout-saved-addresses'] });
      toast({ title: t('checkout.delivery.addressCreated') });
      if (data) {
        onChange('savedAddressId', data.id);
        setOriginalAddress(data as SavedAddress);
      }
    },
  });

  const handleSaveClick = () => {
    if (originalAddress) setSaveDialogOpen(true);
    else if (user) createMutation.mutate();
  };

  const handleCancelChanges = () => {
    if (originalAddress) {
      onChange('deliveryCity', originalAddress.city);
      onChange('deliveryAddress', originalAddress.address);
    } else {
      onChange('deliveryCity', '');
      onChange('deliveryAddress', '');
    }
  };

  const handleAddNew = () => {
    onChange('savedAddressId', '');
    setOriginalAddress(null);
    onChange('deliveryCity', '');
    onChange('deliveryAddress', '');
    setPopupOpen(false);
  };

  useEffect(() => {
    if (!selectedMethodId || !rates) {
      onShippingCostChange(0);
      return;
    }
    const methodRates = rates.filter((r) => r.method_id === selectedMethodId);
    if (methodRates.length === 0) {
      onShippingCostChange(0);
      return;
    }
    const rate = methodRates[0];
    let cost = rate.base_cost;
    if (
      rate.calculation_type === 'free_from' &&
      rate.free_from_amount &&
      subtotal >= rate.free_from_amount
    ) {
      cost = 0;
    }
    onShippingCostChange(cost);
  }, [selectedMethodId, rates, subtotal, onShippingCostChange]);

  useEffect(() => {
    if (methods && methods.length > 0 && !selectedMethodId) {
      onChange('shippingMethodId', methods[0].id);
    }
  }, [methods, selectedMethodId, onChange]);

  const getRateInfo = (methodId: string) => {
    if (!rates) return null;
    const methodRates = rates.filter((r) => r.method_id === methodId);
    if (methodRates.length === 0) return null;
    const rate = methodRates[0];
    let displayCost = rate.base_cost;
    if (
      rate.calculation_type === 'free_from' &&
      rate.free_from_amount &&
      subtotal >= rate.free_from_amount
    ) {
      displayCost = 0;
    }
    return { cost: displayCost, estimatedDays: rate.estimated_days };
  };

  if (methodsLoading) {
    return (
      <div className="border rounded-lg p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Truck className="h-5 w-5" />
          {t('profile.order.shippingMethod')}
        </h3>
        <div className="space-y-4">
          <div className="animate-pulse h-20 w-full bg-muted rounded" />
          <div className="animate-pulse h-20 w-full bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {t('profile.order.shippingMethod')}
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid gap-3">
            {methods?.map((method) => {
              const IconComponent = getMethodIcon(method.icon);
              const rateInfo = getRateInfo(method.id);
              return (
                <label
                  key={method.id}
                  className={`flex items-center gap-4 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                    selectedMethodId === method.id
                      ? 'border-primary'
                      : 'border-muted hover:bg-accent'
                  }`}
                >
                  <input
                    type="radio"
                    name="shippingMethod"
                    value={method.id}
                    checked={selectedMethodId === method.id}
                    onChange={() => onChange('shippingMethodId', method.id)}
                    className="sr-only"
                  />
                  <IconComponent className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">{method.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {method.description}
                    </div>
                    {rateInfo?.estimatedDays && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {rateInfo.estimatedDays}
                      </div>
                    )}
                  </div>
                  <div className="font-medium text-right">
                    {rateInfo
                      ? formatShippingCost(rateInfo.cost, config, {
                          byTariff: t('common.shipping.byTariff'),
                          free: t('common.shipping.free'),
                        })
                      : '—'}
                  </div>
                </label>
              );
            })}
          </div>

          {isPickup && pickupPoints && pickupPoints.length > 0 && (
            <div className="pt-4 border-t">
              <label className="text-sm font-medium mb-1 block">
                {t('checkout.delivery.pickupPointLabel')}
              </label>
              <select
                value={String(values.pickupPointId || '')}
                onChange={(e) => onChange('pickupPointId', e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="">
                  {t('checkout.delivery.pickupPointPlaceholder')}
                </option>
                {pickupPoints.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.name} - {point.city}, {point.address}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showAddressFields && (
            <div className="space-y-4 pt-4 border-t">
              {user && savedAddresses && savedAddresses.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('checkout.delivery.savedAddresses')}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {visibleAddresses.map((address) => (
                      <AddressCard
                        key={address.id}
                        id={address.id}
                        name={address.name}
                        city={address.city}
                        address={address.address}
                        isSelected={selectedAddressId === address.id}
                        isDefault={address.is_default}
                        onClick={() => handleSelectAddress(address.id)}
                      />
                    ))}
                  </div>
                  {showMoreButton && (
                    <button
                      type="button"
                      className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
                      onClick={() => setPopupOpen(true)}
                    >
                      {t('checkout.delivery.showAll', {
                        count: savedAddresses.length,
                      })}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('checkout.cityLabel')}
                </label>
                <input
                  placeholder={t('checkout.cityPlaceholder')}
                  value={currentCity || ''}
                  onChange={(e) => onChange('deliveryCity', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t('checkout.delivery.addressLabel')}
                </label>
                <input
                  placeholder={t('checkout.streetAddressPlaceholder')}
                  value={currentAddress || ''}
                  onChange={(e) => onChange('deliveryAddress', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>

              {user && hasChanges && (
                <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
                  <button
                    type="button"
                    className="px-3 py-1.5 border rounded-md text-sm"
                    onClick={handleCancelChanges}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm flex items-center gap-2"
                    onClick={handleSaveClick}
                    disabled={
                      updateMutation.isPending || createMutation.isPending
                    }
                  >
                    <Save className="h-4 w-4" />
                    {t('checkout.delivery.saveAddress')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {savedAddresses && (
        <AddressSelectorPopup
          open={popupOpen}
          onOpenChange={setPopupOpen}
          addresses={savedAddresses}
          selectedId={selectedAddressId ?? null}
          onSelect={handleSelectAddress}
          onAddNew={handleAddNew}
        />
      )}

      <AddressSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        existingAddressName={originalAddress?.name}
        onUpdate={() => updateMutation.mutate()}
        onCreate={() => {
          onChange('savedAddressId', '');
          createMutation.mutate();
        }}
        onCancel={handleCancelChanges}
      />
    </>
  );
}
