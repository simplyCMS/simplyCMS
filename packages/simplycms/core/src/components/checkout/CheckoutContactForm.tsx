
import { User } from "lucide-react";

interface CheckoutContactFormProps {
  values: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  onChange: (field: string, value: string) => void;
}

export function CheckoutContactForm({ values, onChange }: CheckoutContactFormProps) {
  return (
    <div className="border rounded-lg">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <User className="h-5 w-5" />
          Контактнi данi
        </h3>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Iм&apos;я *</label>
            <input
              placeholder="Введiть iм'я"
              value={values.firstName}
              onChange={(e) => onChange("firstName", e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Прiзвище *</label>
            <input
              placeholder="Введiть прiзвище"
              value={values.lastName}
              onChange={(e) => onChange("lastName", e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Email</label>
            <input
              type="email"
              placeholder="email@example.com"
              value={values.email}
              onChange={(e) => onChange("email", e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Телефон</label>
            <input
              type="tel"
              placeholder="+380"
              value={values.phone}
              onChange={(e) => onChange("phone", e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          * Вкажiть email або телефон для зв&apos;язку
        </p>
      </div>
    </div>
  );
}
