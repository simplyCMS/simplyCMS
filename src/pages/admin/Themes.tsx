import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Palette, Check, Settings, Trash2, ArrowLeft } from "lucide-react";
import { InstallThemeDialog } from "@/components/admin/InstallThemeDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ThemeRecord {
  id: string;
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  author: string | null;
  preview_image: string | null;
  is_active: boolean;
  installed_at: string;
}

export default function Themes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteThemeId, setDeleteThemeId] = useState<string | null>(null);

  const { data: themes, isLoading } = useQuery({
    queryKey: ["admin-themes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("themes")
        .select("*")
        .order("installed_at", { ascending: true });
      if (error) throw error;
      return data as ThemeRecord[];
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (themeId: string) => {
      // Deactivate all themes first
      const { error: deactivateError } = await supabase
        .from("themes")
        .update({ is_active: false })
        .neq("id", themeId);
      
      if (deactivateError) throw deactivateError;

      // Activate the selected theme
      const { error: activateError } = await supabase
        .from("themes")
        .update({ is_active: true })
        .eq("id", themeId);
      
      if (activateError) throw activateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-themes"] });
      toast({
        title: "Тему активовано",
        description: "Зміни будуть застосовані після оновлення сторінки",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося активувати тему",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (themeId: string) => {
      const { error } = await supabase
        .from("themes")
        .delete()
        .eq("id", themeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-themes"] });
      setDeleteThemeId(null);
      toast({
        title: "Тему видалено",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося видалити тему",
      });
    },
  });

  const themeToDelete = themes?.find(t => t.id === deleteThemeId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/settings">
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
        <InstallThemeDialog />
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
            <h3 className="text-lg font-semibold mb-2">Немає встановлених тем</h3>
            <p className="text-muted-foreground">
              Встановіть тему для налаштування зовнішнього вигляду магазину
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {themes?.map((theme) => (
            <Card key={theme.id} className={theme.is_active ? "ring-2 ring-primary" : ""}>
              {/* Preview image */}
              <div className="relative h-48 bg-muted rounded-t-lg overflow-hidden">
                {theme.preview_image ? (
                  <img
                    src={theme.preview_image}
                    alt={theme.display_name}
                    className="w-full h-full object-cover"
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
                      <Link to={`/admin/themes/${theme.id}`}>
                        <Settings className="h-4 w-4 mr-2" />
                        Налаштування
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="flex-1"
                        onClick={() => activateMutation.mutate(theme.id)}
                        disabled={activateMutation.isPending}
                      >
                        Активувати
                      </Button>
                      <Button variant="outline" size="icon" asChild>
                        <Link to={`/admin/themes/${theme.id}`}>
                          <Settings className="h-4 w-4" />
                        </Link>
                      </Button>
                      {theme.name !== "default" && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDeleteThemeId(theme.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteThemeId} onOpenChange={() => setDeleteThemeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити тему?</AlertDialogTitle>
            <AlertDialogDescription>
              Ви впевнені, що хочете видалити тему "{themeToDelete?.display_name}"?
              Цю дію неможливо скасувати.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteThemeId && deleteMutation.mutate(deleteThemeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
