import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, CheckCircle, XCircle, Info, ChevronRight } from 'lucide-react';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@simplycms/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import { Badge } from '@simplycms/ui/badge';
import { Label } from '@simplycms/ui/label';
import { Separator } from '@simplycms/ui/separator';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT } from 'simplycms/i18n';
import { resolvePrice, type PriceEntry } from '@simplycms/core/lib/priceUtils';
import {
  resolveDiscount,
  type DiscountGroup,
  type DiscountContext,
  type GroupOperator,
  type AppliedDiscount,
  type RejectedDiscount,
} from '@simplycms/core/lib/discountEngine';

/** Крок валідації ціни */
interface ValidationStep {
  title: string;
  value: string;
  reason: string;
  status: 'ok' | 'error' | 'info';
  oldPrice?: number | null;
  applied?: AppliedDiscount[];
  rejected?: RejectedDiscount[];
}

export default function PriceValidator() {
  const t = useT();
  const supabase = useSupabaseClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedModificationId, setSelectedModificationId] =
    useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [cartTotal, setCartTotal] = useState<number>(0);
  const [result, setResult] = useState<ValidationStep[] | null>(null);

  // Load users (profiles)
  const { data: users = [] } = useQuery({
    queryKey: ['validator-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'user_id, first_name, last_name, email, category_id, user_categories(id, name, price_type_id, price_types(id, name))',
        )
        .order('email')
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Load products
  const { data: products = [] } = useQuery({
    queryKey: ['validator-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, section_id, has_modifications')
        .eq('is_active', true)
        .order('name')
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Load modifications for selected product
  const { data: modifications = [] } = useQuery({
    queryKey: ['validator-modifications', selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return [];
      const { data, error } = await supabase
        .from('product_modifications')
        .select('id, name')
        .eq('product_id', selectedProductId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProductId,
  });

  // Load default price type
  const { data: defaultPriceType } = useQuery({
    queryKey: ['default-price-type'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_types')
        .select('id, name')
        .eq('is_default', true)
        .single();
      if (error) return null;
      return data;
    },
  });

  const validate = async () => {
    if (!selectedProductId) return;

    const steps: ValidationStep[] = [];
    const product = products.find((p) => p.id === selectedProductId);

    // Step 1: Determine price type
    let priceTypeId: string | null = null;
    let priceTypeName = '';
    let priceTypeReason = '';

    const user = users.find((u) => u.user_id === selectedUserId);
    if (user && user.user_categories) {
      const cat = user.user_categories;
      if (cat.price_type_id && cat.price_types) {
        priceTypeId = cat.price_type_id;
        priceTypeName = cat.price_types.name;
        priceTypeReason = t('admin.validator.categoryStep', {
          category: cat.name,
          priceType: priceTypeName,
        });
      }
    }

    if (!priceTypeId && defaultPriceType) {
      priceTypeId = defaultPriceType.id;
      priceTypeName = defaultPriceType.name;
      priceTypeReason = selectedUserId
        ? t('admin.validator.noCategoryStep', { priceType: priceTypeName })
        : t('admin.validator.guestStep', { priceType: priceTypeName });
    }

    steps.push({
      title: t('admin.users.priceType'),
      value: priceTypeName || t('admin.validator.undefined'),
      reason: priceTypeReason || t('admin.validator.noPriceType'),
      status: priceTypeId ? 'ok' : 'error',
    });

    // Step 2: Get base price
    const { data: prices } = await supabase
      .from('product_prices')
      .select('price_type_id, price, old_price, modification_id')
      .eq('product_id', selectedProductId);

    const modId = selectedModificationId || null;
    const resolved = resolvePrice(
      (prices || []) as PriceEntry[],
      priceTypeId,
      defaultPriceType?.id || null,
      modId,
    );

    steps.push({
      title: t('admin.orders.basePrice'),
      value:
        resolved.price !== null
          ? t('admin.validator.uah', { value: resolved.price })
          : t('admin.validator.notFound'),
      reason:
        resolved.price !== null
          ? `product_prices (price_type: "${priceTypeName}", ${modId ? 'modification' : 'product'})`
          : t('admin.validator.noPriceForType'),
      status: resolved.price !== null ? 'ok' : 'error',
      oldPrice: resolved.oldPrice,
    });

    // Step 3: Calculate discounts
    if (resolved.price !== null && priceTypeId) {
      // Load discounts for this price type
      const { data: dbDiscounts } = await supabase
        .from('discounts')
        .select('*, discount_targets(*), discount_conditions(*)')
        .eq('price_type_id', priceTypeId)
        .eq('is_active', true);

      if (!dbDiscounts?.length) {
        steps.push({
          title: t('admin.nav.discounts'),
          value: t('admin.validator.none'),
          reason: t('admin.validator.noDiscountForType'),
          status: 'info',
          applied: [],
          rejected: [],
        });
        steps.push({
          title: t('admin.validator.finalPrice'),
          value: t('admin.validator.uah', { value: resolved.price.toFixed(2) }),
          reason: t('admin.validator.noDiscount', { price: resolved.price }),
          status: 'ok',
        });
        setResult(steps);
        return;
      }

      // Load groups for these discounts
      const groupIds = [...new Set(dbDiscounts.map((d) => d.group_id))];
      const { data: dbGroups } = await supabase
        .from('discount_groups')
        .select('*')
        .in('id', groupIds)
        .eq('is_active', true);

      // Build tree
      const allGroups = dbGroups || [];
      const groupMap = new Map<string, DiscountGroup>();
      for (const g of allGroups) {
        groupMap.set(g.id, {
          id: g.id,
          name: g.name,
          description: g.description,
          operator: g.operator as GroupOperator,
          is_active: g.is_active,
          priority: g.priority,
          starts_at: g.starts_at,
          ends_at: g.ends_at,
          discounts: [],
          children: [],
        });
      }

      for (const d of dbDiscounts) {
        const group = groupMap.get(d.group_id);
        if (group) {
          group.discounts.push({
            id: d.id,
            name: d.name,
            description: d.description,
            discount_type: d.discount_type,
            discount_value: Number(d.discount_value),
            priority: d.priority,
            is_active: d.is_active,
            starts_at: d.starts_at,
            ends_at: d.ends_at,
            targets: d.discount_targets || [],
            conditions: d.discount_conditions || [],
          });
        }
      }

      // Build parent-child
      const roots: DiscountGroup[] = [];
      for (const g of allGroups) {
        const node = groupMap.get(g.id)!;
        if (g.parent_group_id && groupMap.has(g.parent_group_id)) {
          groupMap.get(g.parent_group_id)!.children.push(node);
        } else {
          roots.push(node);
        }
      }

      const ctx: DiscountContext = {
        userId: selectedUserId || null,
        userCategoryId: user?.category_id || null,
        quantity,
        cartTotal: cartTotal || resolved.price * quantity,
        productId: selectedProductId,
        modificationId: modId,
        sectionId: product?.section_id || null,
        isLoggedIn: !!selectedUserId,
      };

      const discountResult = resolveDiscount(resolved.price, roots, ctx);

      steps.push({
        title: t('admin.nav.discounts'),
        value:
          discountResult.totalDiscount > 0
            ? t('admin.validator.discountSum', {
                value: discountResult.totalDiscount.toFixed(2),
              })
            : t('admin.validator.none'),
        reason:
          discountResult.appliedDiscounts.length > 0
            ? t('admin.validator.appliedCount', {
                count: discountResult.appliedDiscounts.length,
              })
            : t('admin.validator.noneApplies'),
        status: 'info',
        applied: discountResult.appliedDiscounts,
        rejected: discountResult.rejectedDiscounts,
      });

      steps.push({
        title: t('admin.validator.finalPrice'),
        value: t('admin.validator.uah', {
          value: discountResult.finalPrice.toFixed(2),
        }),
        reason:
          discountResult.totalDiscount > 0
            ? `${resolved.price} - ${discountResult.totalDiscount.toFixed(2)} = ${discountResult.finalPrice.toFixed(2)}`
            : t('admin.validator.noDiscount', { price: resolved.price }),
        status: 'ok',
      });
    }

    setResult(steps);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.nav.priceValidator')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('admin.validator.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.validator.params')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('admin.users.user')}</Label>
              <Select
                value={selectedUserId || '__guest__'}
                onValueChange={(v) =>
                  setSelectedUserId(v === '__guest__' ? '' : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.validator.guestOption')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__guest__">
                    {t('admin.validator.guest')}
                  </SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.first_name || ''} {u.last_name || ''} (
                      {u.email || t('admin.validator.noEmail')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('admin.orders.product')}</Label>
              <Select
                value={selectedProductId}
                onValueChange={(v) => {
                  setSelectedProductId(v);
                  setSelectedModificationId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.discounts.pickProduct')} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {modifications.length > 0 && (
            <div className="space-y-2">
              <Label>{t('admin.discounts.modification')}</Label>
              <Select
                value={selectedModificationId || '__none__'}
                onValueChange={(v) =>
                  setSelectedModificationId(v === '__none__' ? '' : v)
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('admin.validator.noModification')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t('admin.validator.noModification')}
                  </SelectItem>
                  {modifications.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('common.quantity')}</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.validator.cartTotal')}</Label>
              <Input
                type="number"
                min={0}
                value={cartTotal}
                onChange={(e) => setCartTotal(Number(e.target.value))}
              />
            </div>
          </div>

          <Button onClick={validate} disabled={!selectedProductId}>
            <Search className="h-4 w-4 mr-2" /> {t('admin.validator.run')}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.validator.result')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.map((step, idx) => (
              <div key={idx}>
                <div className="flex items-start gap-3">
                  {step.status === 'ok' && (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  )}
                  {step.status === 'error' && (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  )}
                  {step.status === 'info' && (
                    <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {idx + 1}.
                      </span>
                      <span className="font-medium">{step.title}:</span>
                      <span className="font-bold">{step.value}</span>
                      {step.oldPrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          {t('admin.validator.uah', {
                            value: step.oldPrice,
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {step.reason}
                    </p>

                    {/* Applied discounts */}
                    {step.applied && step.applied.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {step.applied.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            <Badge
                              variant="outline"
                              className="bg-green-50 dark:bg-green-950 text-xs"
                            >
                              {t('admin.validator.applied')}
                            </Badge>
                            <span>
                              {d.type === 'percent'
                                ? `-${d.value}%`
                                : d.type === 'fixed_amount'
                                  ? t('admin.validator.discountSum', {
                                      value: d.value,
                                    })
                                  : t('admin.validator.fixedUah', {
                                      value: d.value,
                                    })}
                            </span>
                            <span className="text-muted-foreground">
                              "{d.name}"
                            </span>
                            <span className="text-muted-foreground">
                              ({d.groupName})
                            </span>
                            <span className="font-medium">
                              ={' '}
                              {t('admin.validator.discountSum', {
                                value: d.calculatedAmount.toFixed(2),
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Rejected discounts */}
                    {step.rejected && step.rejected.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {step.rejected.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                            <Badge
                              variant="outline"
                              className="bg-red-50 dark:bg-red-950 text-xs"
                            >
                              {t('admin.validator.rejected')}
                            </Badge>
                            <span className="text-muted-foreground">
                              "{d.name}"
                            </span>
                            <span className="text-muted-foreground">
                              ({d.groupName})
                            </span>
                            <ChevronRight className="h-3 w-3" />
                            <span className="text-sm text-red-600 dark:text-red-400">
                              {d.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {idx < result.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
