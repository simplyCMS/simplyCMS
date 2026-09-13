import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from 'simplycms/ui/button';
import { Form, FormField, FormItem, FormMessage } from 'simplycms/ui/form';
import { useCart } from 'simplycms/core/hooks/useCart';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import { getProfileSettings } from '../server/profile';
import { placeOrder } from '../server/checkout';
import { useT, type Translator } from 'simplycms/i18n';
import { toast } from 'simplycms/core/hooks/use-toast';
import {
  CheckoutAuthBlock,
  CheckoutContactForm,
  CheckoutDeliveryForm,
  CheckoutPaymentForm,
  CheckoutOrderSummary,
  CheckoutRecipientForm,
  REJECTION_KEY,
} from 'simplycms/checkout-ui';
import { PluginSlot } from 'simplycms/plugins/PluginSlot';
import { toCheckoutItems } from './checkout/build-quote-input';
import { useCheckoutQuote } from './checkout/useCheckoutQuote';

/**
 * Фабрика схеми, а не константа модуля: повідомлення валідації беруться з
 * каталогу, а транслятор доступний лише всередині рендера (`useT`). Схема
 * мемоїзується по `t`, тож перебудови на кожен рендер немає.
 */
const buildCheckoutSchema = (t: Translator) =>
  z
    .object({
      firstName: z
        .string()
        .min(2, t('validation.min2'))
        .max(100, t('validation.max100')),
      lastName: z
        .string()
        .min(2, t('validation.min2'))
        .max(100, t('validation.max100')),
      email: z
        .string()
        .email(t('validation.emailFormat'))
        .optional()
        .or(z.literal('')),
      phone: z.string().optional(),
      shippingMethodId: z.string().min(1, t('validation.shippingRequired')),
      deliveryCity: z.string().optional(),
      deliveryAddress: z.string().optional(),
      pickupPointId: z.string().optional(),
      paymentMethod: z.enum(['cash', 'online'], {
        message: t('validation.paymentRequired'),
      }),
      notes: z.string().optional(),
      // Recipient fields
      hasDifferentRecipient: z.boolean(),
      savedRecipientId: z.string().optional(),
      recipientFirstName: z.string().optional(),
      recipientLastName: z.string().optional(),
      recipientPhone: z.string().optional(),
      recipientEmail: z.string().optional(),
      recipientCity: z.string().optional(),
      recipientAddress: z.string().optional(),
      recipientNotes: z.string().optional(),
      saveRecipient: z.boolean(),
      // Address fields
      savedAddressId: z.string().optional(),
      saveAddress: z.boolean(),
    })
    .refine(
      (data) => {
        // Require at least email OR phone
        const hasEmail = data.email && data.email.length > 0;
        const hasPhone = data.phone && data.phone.length >= 10;
        return hasEmail || hasPhone;
      },
      {
        message: t('validation.contactRequired'),
        path: ['phone'],
      },
    )
    .refine(
      (data) => {
        // If different recipient is selected, require recipient details
        if (data.hasDifferentRecipient) {
          return (
            data.recipientFirstName &&
            data.recipientFirstName.length >= 2 &&
            data.recipientLastName &&
            data.recipientLastName.length >= 2 &&
            data.recipientPhone &&
            data.recipientPhone.length >= 10 &&
            data.recipientCity &&
            data.recipientCity.length >= 2 &&
            data.recipientAddress &&
            data.recipientAddress.length >= 5
          );
        }
        return true;
      },
      {
        message: t('validation.recipientRequired'),
        path: ['recipientFirstName'],
      },
    );

type CheckoutFormData = z.infer<ReturnType<typeof buildCheckoutSchema>>;

export default function Checkout() {
  const t = useT();
  const navigate = useNavigate();
  const { items, totalPrice, clearCart, hydrated } = useCart();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasShippingMethods, setHasShippingMethods] = useState(true);
  const checkoutSchema = useMemo(() => buildCheckoutSchema(t), [t]);

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      shippingMethodId: '',
      deliveryCity: '',
      deliveryAddress: '',
      pickupPointId: '',
      paymentMethod: 'cash',
      notes: '',
      hasDifferentRecipient: false,
      savedRecipientId: '',
      recipientFirstName: '',
      recipientLastName: '',
      recipientPhone: '',
      recipientEmail: '',
      recipientCity: '',
      recipientAddress: '',
      recipientNotes: '',
      saveRecipient: false,
      savedAddressId: '',
      saveAddress: false,
    },
  });

  // Автозаповнення для залогінених: профіль тягне сервер під актором сесії
  // (`getProfileSettings`), тож `user.id` у запит більше не їде з браузера.
  useEffect(() => {
    if (!user) return;

    void getProfileSettings().then((profile) => {
      if (profile) {
        form.setValue('firstName', profile.first_name || '');
        form.setValue('lastName', profile.last_name || '');
        form.setValue('email', profile.email || user.email || '');
        form.setValue('phone', profile.phone || '');
      } else if (user.email) {
        form.setValue('email', user.email);
      }
    });
  }, [user, form]);

  // Redirect if cart is empty. 🔴 Гейт на `hydrated` (Е0-5, рішення А
  // архітектора): гідраційний рендер завжди бачить ПОРОЖНІЙ кошик
  // (`getServerSnapshot`), а passive-ефекти комітяться дітьми-вперед — без
  // гейту цей ефект відпрацював би РАНІШЕ за перечитування localStorage в
  // `CartProvider` і хибно редиректив би на /cart при прямому вході на
  // /checkout з непорожнім кошиком.
  useEffect(() => {
    if (hydrated && items.length === 0) {
      navigate({ to: '/cart' });
    }
  }, [hydrated, items, navigate]);

  // 🔴 Серверна квота (розділ M рішень архітектора): і показ, і запис
  // рахує та сама `prepareCheckout`, тож підсумок ніколи не бреше про суму —
  // клієнтські `totalPrice`/ціни кошика в підсумку більше не беруть участі.
  // 🔴 `useWatch`, а не `form.watch()`: значення тут ідуть далі в
  // залежності ефекту (`useCheckoutQuote`) — `form.watch()` повертає
  // нестабільну функцію, яку React Compiler не вміє безпечно
  // мемоїзувати саме в такому вжитку (`react-hooks/incompatible-library`).
  const shippingMethodId =
    useWatch({ control: form.control, name: 'shippingMethodId' }) || '';
  const pickupPointId =
    useWatch({ control: form.control, name: 'pickupPointId' }) || '';
  const deliveryCity =
    useWatch({ control: form.control, name: 'deliveryCity' }) || '';
  const { quote, quoting, matchesCurrent } = useCheckoutQuote({
    items,
    shippingMethodId,
    pickupPointId,
    deliveryCity,
    userKey: user?.id ?? null,
  });
  // Submit без свіжої квоти неможливий (M-8): доставка обрана, квота вдала
  // і рахована саме на ПОТОЧНИХ входах.
  const canSubmit =
    hasShippingMethods && quote?.ok === true && !quoting && matchesCurrent;

  /**
   * 🔴 Оформлення — ОДИН серверний виклик. Раніше браузер сам робив пʼять
   * записів у базу (отримувач → статус → спосіб доставки → замовлення →
   * позиції), і падіння будь-якого з них лишало в базі напівстворене
   * замовлення. Тепер усе це одна транзакція актора на сервері.
   */
  const onSubmit = async (data: CheckoutFormData) => {
    if (items.length === 0) {
      toast({
        title: t('checkout.emptyCart'),
        description: t('checkout.emptyCartHint'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 🔴 Кошик несе ЛИШЕ ідентичність і кількість — ціну, назву й знижку
      // рахує сервер у власній транзакції (`priceCheckoutItems`), тож
      // клієнтські значення тут нізвідки підмінити.
      const result = await placeOrder({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || '',
          phone: data.phone || '',
          shippingMethodId: data.shippingMethodId,
          deliveryCity: data.deliveryCity || null,
          deliveryAddress: data.deliveryAddress || null,
          pickupPointId: data.pickupPointId || null,
          paymentMethod: data.paymentMethod,
          notes: data.notes || null,
          hasDifferentRecipient: data.hasDifferentRecipient,
          recipientFirstName: data.recipientFirstName || null,
          recipientLastName: data.recipientLastName || null,
          recipientPhone: data.recipientPhone || null,
          recipientEmail: data.recipientEmail || null,
          recipientCity: data.recipientCity || null,
          recipientAddress: data.recipientAddress || null,
          recipientNotes: data.recipientNotes || null,
          saveRecipient: data.saveRecipient,
          savedRecipientId:
            data.savedRecipientId && data.savedRecipientId !== 'new'
              ? data.savedRecipientId
              : null,
          savedAddressId: data.savedAddressId || null,
          items: toCheckoutItems(items),
        },
      });

      if (!result.ok) {
        toast({
          title: t('checkout.failed'),
          description: t(REJECTION_KEY[result.reason]),
          variant: 'destructive',
        });
        return;
      }
      const { order } = result;

      clearCart();

      toast({
        title: t('checkout.placed'),
        description: t('checkout.placedNumber', { number: order.orderNumber }),
      });

      navigate({
        to: '/order-success/$orderId',
        params: { orderId: order.id },
        search: { token: order.accessToken ?? undefined },
      });
    } catch (error: unknown) {
      console.error('Order creation error:', error);
      toast({
        title: t('checkout.failed'),
        description:
          error instanceof Error ? error.message : t('checkout.retry'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle auth success - reload profile data
  const handleAuthSuccess = async () => {
    // Profile will be loaded by the useEffect when user changes
  };

  // 🔴 Той самий гейт на `hydrated`, що й у ефекті вище: до гідратації
  // `items` завжди порожній, і без гейту тут був би спалах «порожній кошик»
  // на прямому вході в /checkout, доки CartProvider не перечитає localStorage.
  if (hydrated && items.length === 0) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors">
          {t('breadcrumbs.home')}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link to="/cart" className="hover:text-foreground transition-colors">
          {t('cart.title')}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{t('checkout.title')}</span>
      </nav>

      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/cart">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">{t('checkout.title')}</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Forms column */}
            <div className="lg:col-span-2 space-y-6">
              <PluginSlot
                name="checkout.shipping.before"
                context={{ cart: { items, subtotal: totalPrice } }}
              />

              {/* Auth block for non-logged-in users */}
              {!user && <CheckoutAuthBlock onAuthSuccess={handleAuthSuccess} />}

              <CheckoutContactForm
                values={{
                  firstName: form.watch('firstName'),
                  lastName: form.watch('lastName'),
                  email: form.watch('email') || '',
                  phone: form.watch('phone') || '',
                }}
                onChange={(field, value) =>
                  form.setValue(field as keyof CheckoutFormData, value)
                }
              />
              <CheckoutRecipientForm
                values={form.watch()}
                onChange={(field, value) =>
                  form.setValue(field as keyof CheckoutFormData, value)
                }
              />
              <CheckoutDeliveryForm
                values={form.watch()}
                onChange={(field, value) =>
                  form.setValue(field as keyof CheckoutFormData, value)
                }
                subtotal={totalPrice}
                onAvailabilityChange={setHasShippingMethods}
              />
              <FormField
                control={form.control}
                name="shippingMethodId"
                render={() => (
                  <FormItem>
                    {/* Поля-радіо живуть у CheckoutDeliveryForm; повідомлення
                        validation.shippingRequired до К2-Е0 не мало де
                        зʼявитись — тому лише FormMessage. */}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <CheckoutPaymentForm
                selectedMethod={form.watch('paymentMethod')}
                onMethodChange={(method) =>
                  form.setValue('paymentMethod', method as 'cash' | 'online')
                }
              />

              <PluginSlot
                name="checkout.shipping.after"
                context={{ cart: { items, subtotal: totalPrice } }}
              />
            </div>

            {/* Order summary column */}
            <div className="lg:col-span-1">
              <CheckoutOrderSummary
                quote={quote}
                quoting={quoting}
                notes={form.watch('notes') || ''}
                onNotesChange={(notes) => form.setValue('notes', notes)}
                isSubmitting={isSubmitting}
                canSubmit={canSubmit}
              />
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
