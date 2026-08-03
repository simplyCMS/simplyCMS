import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import { Button } from '@simplycms/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@simplycms/ui/card';
import { Badge } from '@simplycms/ui/badge';
import { Skeleton } from '@simplycms/ui/skeleton';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { Palette, Check, Settings, ArrowLeft } from 'lucide-react';
import { adminPath } from '../lib/adminLinks';
import {
  revalidateFailureDescription,
  revalidateTheme,
} from '../lib/revalidateTheme';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@simplycms/ui/alert-dialog';

interface ThemeRecord {
  id: string;
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  author: string | null;
  preview_image: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Themes() {
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmThemeId, setConfirmThemeId] = useState<string | null>(null);

  const { data: themes, isLoading } = useQuery({
    queryKey: ['admin-themes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ThemeRecord[];
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (themeId: string) => {
      // Деактивувати всі теми
      const { error: deactivateError } = await supabase
        .from('themes')
        .update({ is_active: false })
        .neq('id', themeId);

      if (deactivateError) throw deactivateError;

      // Активувати обрану тему
      const { error: activateError } = await supabase
        .from('themes')
        .update({ is_active: true })
        .eq('id', themeId);

      if (activateError) throw activateError;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['admin-themes'] });
      setConfirmThemeId(null);

      try {
        await revalidateTheme();
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Тему активовано, але кеш вітрини не скинуто',
          description: revalidateFailureDescription(error),
        });
        return;
      }

      toast({
        title: 'Тему активовано',
        description: 'Зміни застосовані на сайті',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Помилка',
        description:
          error instanceof Error ? error.message : 'Не вдалося активувати тему',
      });
    },
  });

  const themeToActivate = themes?.find((t) => t.id === confirmThemeId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={adminPath('settings')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Теми оформлення</h1>
          <p className="text-muted-foreground">
            Управління зовнішнім виглядом магазину
          </p>
        </div>
      </div>

      {/* Themes grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <Card key={i}>
              <Skeleton className="h-48 w-full rounded-t-lg" />
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : themes?.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Palette className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Немає зареєстрованих тем
            </h3>
            <p className="text-muted-foreground">
              Теми додаються через код проекту та міграції БД
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {themes?.map((theme) => (
            <Card
              key={theme.id}
              className={theme.is_active ? 'ring-2 ring-primary' : ''}
            >
              {/* Preview image */}
              <div className="relative h-48 bg-muted rounded-t-lg overflow-hidden">
                {theme.preview_image ? (
                  <img
                    src={theme.preview_image}
                    alt={theme.display_name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Palette className="h-16 w-16 text-muted-foreground/50" />
                  </div>
                )}
                {theme.is_active && (
                  <Badge className="absolute top-3 right-3 gap-1">
                    <Check className="h-3 w-3" />
                    Активна
                  </Badge>
                )}
              </div>

              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {theme.display_name}
                  <span className="text-sm font-normal text-muted-foreground">
                    v{theme.version}
                  </span>
                </CardTitle>
                <CardDescription>
                  {theme.author && <span>Автор: {theme.author}</span>}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {theme.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {theme.description}
                  </p>
                )}

                <div className="flex gap-2">
                  {theme.is_active ? (
                    <Button variant="outline" className="flex-1" asChild>
                      <Link
                        to={adminPath('themes/$themeId/settings')}
                        params={{ themeId: theme.id }}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Налаштування
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="flex-1"
                        onClick={() => setConfirmThemeId(theme.id)}
                        disabled={activateMutation.isPending}
                      >
                        Активувати
                      </Button>
                      <Button variant="outline" size="icon" asChild>
                        <Link
                          to={adminPath('themes/$themeId/settings')}
                          params={{ themeId: theme.id }}
                        >
                          <Settings className="h-4 w-4" />
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Підтвердження активації теми */}
      <AlertDialog
        open={!!confirmThemeId}
        onOpenChange={() => setConfirmThemeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Активувати тему?</AlertDialogTitle>
            <AlertDialogDescription>
              Тема "{themeToActivate?.display_name}" буде активована. Зміни буде
              застосовано на сайті одразу.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmThemeId && activateMutation.mutate(confirmThemeId)
              }
            >
              Активувати
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
