import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Loader2 } from "lucide-react";
import { installPlugin, getRegisteredPluginModules } from "@/lib/plugins";
import { Badge } from "@/components/ui/badge";

interface InstallPluginDialogProps {
  trigger?: React.ReactNode;
}

export function InstallPluginDialog({ trigger }: InstallPluginDialogProps) {
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

  const registeredModules = getRegisteredPluginModules();
  const availableModules = Array.from(registeredModules.keys());

  const installMutation = useMutation({
    mutationFn: async () => {
      // Check if module exists
      const moduleExists = registeredModules.has(formData.name);
      
      // Get hooks from module if it exists
      let hooks: { name: string; priority?: number }[] = [];
      if (moduleExists) {
        const module = registeredModules.get(formData.name);
        if (module?.manifest?.hooks) {
          hooks = module.manifest.hooks;
        }
      }

      const { data, error } = await supabase
        .from("plugins")
        .insert({
          name: formData.name,
          display_name: formData.displayName,
          version: formData.version,
          description: formData.description || null,
          author: formData.author || null,
          is_active: false,
          config: {},
          hooks: hooks,
          migrations_applied: [],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Плагін встановлено",
        description: `Плагін "${formData.displayName}" успішно додано до системи.`,
      });
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
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
        description: "Назва та відображувана назва обов'язкові",
        variant: "destructive",
      });
      return;
    }
    installMutation.mutate();
  };

  const handleModuleSelect = (moduleName: string) => {
    const module = registeredModules.get(moduleName);
    setFormData((prev) => ({
      ...prev,
      name: moduleName,
      displayName: module?.manifest?.displayName || moduleName,
      version: module?.manifest?.version || "1.0.0",
      description: module?.manifest?.description || "",
      author: module?.manifest?.author || "",
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Встановити плагін
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Встановлення плагіна</DialogTitle>
            <DialogDescription>
              Додайте новий плагін до системи. Виберіть із зареєстрованих модулів або введіть дані вручну.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Available modules */}
            {availableModules.length > 0 && (
              <div className="space-y-2">
                <Label>Доступні модулі</Label>
                <div className="flex flex-wrap gap-2">
                  {availableModules.map((name) => (
                    <Badge
                      key={name}
                      variant={formData.name === name ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleModuleSelect(name)}
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Натисніть на модуль, щоб заповнити форму автоматично
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Системна назва <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="my-plugin"
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
                <Label htmlFor="displayName">
                  Відображувана назва <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="displayName"
                  placeholder="Мій плагін"
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, displayName: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="version">Версія</Label>
                <Input
                  id="version"
                  placeholder="1.0.0"
                  value={formData.version}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, version: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="author">Автор</Label>
                <Input
                  id="author"
                  placeholder="Ваше ім'я"
                  value={formData.author}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, author: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Опис</Label>
              <Textarea
                id="description"
                placeholder="Короткий опис функціональності плагіна..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
              />
            </div>

            {formData.name && !registeredModules.has(formData.name) && (
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  ⚠️ Модуль "{formData.name}" не знайдено в системі. Плагін буде зареєстровано, 
                  але для його роботи потрібно додати код модуля до проєкту.
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
