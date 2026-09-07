import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, Banknote } from "lucide-react";

interface CheckoutPaymentFormProps {
  form: UseFormReturn<any>;
}

const paymentMethods = [
  {
    id: "cash",
    name: "Оплата при отриманні",
    description: "Готівкою або карткою при отриманні",
    icon: Banknote,
  },
  {
    id: "online",
    name: "Онлайн оплата",
    description: "Банківська картка (скоро)",
    icon: CreditCard,
    disabled: true,
  },
];

export function CheckoutPaymentForm({ form }: CheckoutPaymentFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Спосіб оплати
        </CardTitle>
      </CardHeader>
      <CardContent>
        <FormField
          control={form.control}
          name="paymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid gap-3"
                >
                  {paymentMethods.map((method) => (
                    <div key={method.id}>
                      <RadioGroupItem
                        value={method.id}
                        id={`payment-${method.id}`}
                        className="peer sr-only"
                        disabled={method.disabled}
                      />
                      <Label
                        htmlFor={`payment-${method.id}`}
                        className={`flex items-center gap-4 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors ${
                          method.disabled ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <method.icon className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">{method.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {method.description}
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
