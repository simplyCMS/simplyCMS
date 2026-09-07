import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2 } from "lucide-react";
import { ThemeRegistry } from "@/lib/themes/ThemeRegistry";

interface InstallThemeDialogProps {
  trigger?: React.ReactNode;
}

export function InstallThemeDialog({ trigger }: InstallThemeDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    version: "1.0.0",
    description: "",
    author: "",
  });

  const registeredThemes = ThemeRegistry.getRegisteredThemes();

  const installMutation = useMutation({
    mutationFn: async () => {
      // Try to load the theme module to get settings_schema
      let settingsSchema = {};
      if (ThemeRegistry.has(formData.name)) {
        try {
          const themeModule = await ThemeRegistry.load(formData.name);
          settingsSchema = themeModule.manifest.settings || {};
        } catch {
          // Module exists but failed to load - still allow install
        }
      }

      const { data, error } = await supabase
        .from("themes")
        .insert({
          name: formData.name,
          display_name: formData.displayName,
          version: formData.version,
          description: formData.description || null,
          author: formData.author || null,
          is_active: false,
          config: {},
          settings_schema: settingsSchema,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Тему встановлено",
        description: `Тема "${formData.displayName}" успішно додана до системи.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-themes"] });
      setOpen(false);
      setFormData({
        name: "",
        displayName: "",
        version: "1.0.0",
        description: "",
        author: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка встановлення",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.displayName) {
      toast({
        title: "Заповніть обов'язкові поля",
        description: "Системна назва та відображувана назва обов'язкові",
        variant: "destructive",
      });
      return;
    }
    installMutation.mutate();
  };

  const handleThemeSelect = async (themeName: string) => {
    try {
      const themeModule = await ThemeRegistry.load(themeName);
      setFormData({
        name: themeName,
        displayName: themeModule.manifest.displayName,
        version: themeModule.manifest.version,
        description: themeModule.manifest.description || "",
        author: themeModule.manifest.author || "",
      });
    } catch {
      setFormData((prev) => ({ ...prev, name: themeName }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Встановити тему
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Встановлення теми</DialogTitle>
            <DialogDescription>
              Додайте нову тему до системи. Виберіть із зареєстрованих модулів
              або введіть дані вручну.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Registered theme modules */}
            {registeredThemes.length > 0 && (
              <div className="space-y-2">
                <Label>Доступні модулі тем</Label>
                <div className="flex flex-wrap gap-2">
                  {registeredThemes.map((name) => (
                    <Badge
                      key={name}
                      variant={formData.name === name ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleThemeSelect(name)}
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Натисніть на тему, щоб заповнити форму автоматично
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="theme-name">
                  Системна назва <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="theme-name"
                  placeholder="my-theme"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Унікальна назва (латиницею, без пробілів)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme-displayName">
                  Відображувана назва <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="theme-displayName"
                  placeholder="Моя тема"
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      displayName: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="theme-version">Версія</Label>
                <Input
                  id="theme-version"
                  placeholder="1.0.0"
                  value={formData.version}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      version: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme-author">Автор</Label>
                <Input
                  id="theme-author"
                  placeholder="Ваше ім'я"
                  value={formData.author}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      author: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme-description">Опис</Label>
              <Textarea
                id="theme-description"
                placeholder="Короткий опис теми..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            {formData.name && !ThemeRegistry.has(formData.name) && (
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  ⚠️ Модуль теми "{formData.name}" не знайдено в системі. Тема
                  буде зареєстрована, але для її роботи потрібно додати код
                  модуля до проєкту.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Скасувати
            </Button>
            <Button type="submit" disabled={installMutation.isPending}>
              {installMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Встановити
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
