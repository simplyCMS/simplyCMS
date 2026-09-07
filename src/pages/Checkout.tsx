import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckoutAuthBlock } from "@/components/checkout/CheckoutAuthBlock";
import { CheckoutContactForm } from "@/components/checkout/CheckoutContactForm";
import { CheckoutDeliveryForm } from "@/components/checkout/CheckoutDeliveryForm";
import { CheckoutPaymentForm } from "@/components/checkout/CheckoutPaymentForm";
import { CheckoutOrderSummary } from "@/components/checkout/CheckoutOrderSummary";
import { CheckoutRecipientForm } from "@/components/checkout/CheckoutRecipientForm";
import { PluginSlot } from "@/components/plugins/PluginSlot";

const checkoutSchema = z.object({
  firstName: z.string().min(2, "Мінімум 2 символи").max(100, "Максимум 100 символів"),
  lastName: z.string().min(2, "Мінімум 2 символи").max(100, "Максимум 100 символів"),
  email: z.string().email("Невірний формат email").optional().or(z.literal("")),
  phone: z.string().optional(),
  shippingMethodId: z.string().min(1, "Оберіть спосіб доставки"),
  deliveryCity: z.string().optional(),
  deliveryAddress: z.string().optional(),
  pickupPointId: z.string().optional(),
  paymentMethod: z.enum(["cash", "online"], {
    required_error: "Оберіть спосіб оплати",
  }),
  notes: z.string().optional(),
  // Recipient fields
  hasDifferentRecipient: z.boolean().default(false),
  savedRecipientId: z.string().optional(),
  recipientFirstName: z.string().optional(),
  recipientLastName: z.string().optional(),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().optional(),
  recipientCity: z.string().optional(),
  recipientAddress: z.string().optional(),
  recipientNotes: z.string().optional(),
  saveRecipient: z.boolean().default(false),
  // Address fields
  savedAddressId: z.string().optional(),
  saveAddress: z.boolean().default(false),
}).refine((data) => {
  // Require at least email OR phone
  const hasEmail = data.email && data.email.length > 0;
  const hasPhone = data.phone && data.phone.length >= 10;
  return hasEmail || hasPhone;
}, {
  message: "Вкажіть email або телефон для зв'язку",
  path: ["phone"],
}).refine((data) => {
  // If different recipient is selected, require recipient details
  if (data.hasDifferentRecipient) {
    return (
      data.recipientFirstName && data.recipientFirstName.length >= 2 &&
      data.recipientLastName && data.recipientLastName.length >= 2 &&
      data.recipientPhone && data.recipientPhone.length >= 10 &&
      data.recipientCity && data.recipientCity.length >= 2 &&
      data.recipientAddress && data.recipientAddress.length >= 5
    );
  }
  return true;
}, {
  message: "Заповніть всі обов'язкові поля отримувача",
  path: ["recipientFirstName"],
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const navigate = useNavigate();
  const { items, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shippingCost, setShippingCost] = useState<number>(0);

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      shippingMethodId: "",
      deliveryCity: "",
      deliveryAddress: "",
      pickupPointId: "",
      paymentMethod: "cash",
      notes: "",
      hasDifferentRecipient: false,
      savedRecipientId: "",
      recipientFirstName: "",
      recipientLastName: "",
      recipientPhone: "",
      recipientEmail: "",
      recipientCity: "",
      recipientAddress: "",
      recipientNotes: "",
      saveRecipient: false,
      savedAddressId: "",
      saveAddress: false,
    },
  });

  // Autofill for logged-in users
  useEffect(() => {
    async function loadProfile() {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, phone")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        form.setValue("firstName", profile.first_name || "");
        form.setValue("lastName", profile.last_name || "");
        form.setValue("email", profile.email || user.email || "");
        form.setValue("phone", profile.phone || "");
      } else if (user.email) {
        form.setValue("email", user.email);
      }
    }

    loadProfile();
  }, [user, form]);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      navigate("/cart");
    }
  }, [items, navigate]);

  const totalWithShipping = totalPrice + shippingCost;

  const onSubmit = async (data: CheckoutFormData) => {
    if (items.length === 0) {
      toast({
        title: "Кошик порожній",
        description: "Додайте товари в кошик перед оформленням",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let savedRecipientId: string | null = null;

      // If saving new recipient, create it first
      if (user && data.hasDifferentRecipient && data.saveRecipient && 
          (!data.savedRecipientId || data.savedRecipientId === "new")) {
        const { data: newRecipient, error: recipientError } = await supabase
          .from("user_recipients")
          .insert({
            user_id: user.id,
            first_name: data.recipientFirstName!,
            last_name: data.recipientLastName!,
            phone: data.recipientPhone!,
            email: data.recipientEmail || null,
            city: data.recipientCity!,
            address: data.recipientAddress!,
            notes: data.recipientNotes || null,
          })
          .select("id")
          .single();

        if (recipientError) throw recipientError;
        savedRecipientId = newRecipient.id;
      } else if (data.savedRecipientId && data.savedRecipientId !== "new") {
        savedRecipientId = data.savedRecipientId;
      }

      // Get default status
      const { data: defaultStatus } = await supabase
        .from("order_statuses")
        .select("id")
        .eq("is_default", true)
        .single();

      // Get shipping method details
      const { data: shippingMethod } = await supabase
        .from("shipping_methods")
        .select("code")
        .eq("id", data.shippingMethodId)
        .single();

      // Create order with all data copied as text
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user?.id || null,
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email || "",
          phone: data.phone || "",
          delivery_method: shippingMethod?.code || null,
          delivery_city: data.deliveryCity || null,
          delivery_address: data.deliveryAddress || null,
          payment_method: data.paymentMethod,
          notes: data.notes || null,
          status_id: defaultStatus?.id || null,
          subtotal: totalPrice,
          total: totalWithShipping,
          shipping_method_id: data.shippingMethodId,
          shipping_cost: shippingCost,
          pickup_point_id: data.pickupPointId || null,
          shipping_data: {},
          order_number: "",
          // Recipient fields - copy as text
          has_different_recipient: data.hasDifferentRecipient,
          recipient_first_name: data.hasDifferentRecipient ? data.recipientFirstName : null,
          recipient_last_name: data.hasDifferentRecipient ? data.recipientLastName : null,
          recipient_phone: data.hasDifferentRecipient ? data.recipientPhone : null,
          recipient_email: data.hasDifferentRecipient ? data.recipientEmail || null : null,
          // References for analytics (will become NULL if deleted)
          saved_recipient_id: savedRecipientId,
          saved_address_id: data.savedAddressId || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items with discount data
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        modification_id: item.modificationId || null,
        name: item.modificationName
          ? `${item.name} - ${item.modificationName}`
          : item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
        base_price: item.basePrice || null,
        discount_data: item.discountData || null,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Clear cart and redirect
      clearCart();
      
      toast({
        title: "Замовлення оформлено!",
        description: `Номер замовлення: ${order.order_number}`,
      });

      // Navigate to success page
      if (user) {
        navigate(`/order-success/${order.id}`);
      } else {
        navigate(`/order-success/${order.id}?token=${order.access_token}`);
      }
    } catch (error: any) {
      console.error("Order creation error:", error);
      toast({
        title: "Помилка оформлення",
        description: error.message || "Спробуйте ще раз",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle auth success - reload profile data
  const handleAuthSuccess = async () => {
    // Profile will be loaded by the useEffect when user changes
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors">
          Головна
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link to="/cart" className="hover:text-foreground transition-colors">
          Кошик
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Оформлення замовлення</span>
      </nav>

      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/cart">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Оформлення замовлення</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Forms column */}
            <div className="lg:col-span-2 space-y-6">
              <PluginSlot name="checkout.shipping.before" context={{ cart: { items, subtotal: totalPrice } }} />
              
              {/* Auth block for non-logged-in users */}
              {!user && (
                <CheckoutAuthBlock onAuthSuccess={handleAuthSuccess} />
              )}
              
              <CheckoutContactForm form={form} />
              <CheckoutRecipientForm form={form} />
              <CheckoutDeliveryForm 
                form={form} 
                subtotal={totalPrice}
                onShippingCostChange={setShippingCost}
              />
              <CheckoutPaymentForm form={form} />
              
              <PluginSlot name="checkout.shipping.after" context={{ cart: { items, subtotal: totalPrice } }} />
            </div>

            {/* Order summary column */}
            <div className="lg:col-span-1">
              <CheckoutOrderSummary
                items={items}
                totalPrice={totalPrice}
                shippingCost={shippingCost}
                form={form}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
