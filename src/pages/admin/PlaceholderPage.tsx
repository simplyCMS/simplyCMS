import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function PlaceholderPage() {
  const location = useLocation();
  const pageName = location.pathname.split("/").pop() || "Сторінка";

  const pageNames: Record<string, string> = {
    "order-statuses": "Статуси замовлень",
    "services": "Послуги",
    "service-requests": "Заявки на послуги",
    "users": "Користувачі",
    "user-categories": "Категорії користувачів",
    "languages": "Мови",
    "settings": "Налаштування",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{pageNames[pageName] || pageName}</h1>
        <p className="text-muted-foreground">Ця сторінка в розробці</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-5 w-5" />
            В розробці
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Ця функціональність буде доступна найближчим часом. 
            Зараз ви можете користуватись іншими розділами CMS.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
