import { useState } from 'react';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { useThemeSettings } from '@simplycms/core/hooks/useThemeSettings';
import { useThemeT } from '@simplycms/themes/useThemeT';
import type { DefaultThemeKey } from '../messages';

export function NewsletterSection() {
  const tt = useThemeT<DefaultThemeKey>();
  const show = useThemeSettings<boolean>('showNewsletter');
  const [email, setEmail] = useState('');
  const { toast } = useToast();

  if (!show) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: tt('theme.newsletter.thanksTitle'),
      description: tt('theme.newsletter.thanksDescription'),
    });
    setEmail('');
  };

  return (
    <section className="py-12 bg-[hsl(var(--muted))]">
      <div className="container mx-auto px-4 text-center max-w-lg">
        <h2 className="text-xl font-serif font-bold text-foreground mb-2">
          {tt('theme.newsletter.heading')}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {tt('theme.newsletter.subtitle')}
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="email"
            placeholder={tt('theme.newsletter.placeholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-card"
          />
          <Button type="submit" className="shrink-0">
            {tt('theme.newsletter.submit')}
          </Button>
        </form>
      </div>
    </section>
  );
}
