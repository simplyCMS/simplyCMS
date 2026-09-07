import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useThemeSettings } from "@/lib/themes";

export function NewsletterSection() {
  const show = useThemeSettings<boolean>("showNewsletter");
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  if (!show) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Дякуємо!", description: "Ви підписані на розсилку." });
    setEmail("");
  };

  return (
    <section className="py-12 bg-[hsl(var(--muted))]">
      <div className="container mx-auto px-4 text-center max-w-lg">
        <h2 className="text-xl font-serif font-bold text-foreground mb-2">
          Підпишіться на розсилку
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Отримуйте новини та спеціальні пропозиції першими
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="email"
            placeholder="Ваш email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-card"
          />
          <Button type="submit" className="shrink-0">
            Підписатись
          </Button>
        </form>
      </div>
    </section>
  );
}
