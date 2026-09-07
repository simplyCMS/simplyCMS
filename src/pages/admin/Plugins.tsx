import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Puzzle, Settings, Trash2 } from "lucide-react";
import {
  getAllPlugins,
  activatePlugin,
  deactivatePlugin,
  uninstallPlugin,
  getRegisteredPluginModules,
} from "@/lib/plugins";
import { parsePlugin, type ParsedPlugin } from "@/lib/plugins/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { InstallPluginDialog } from "@/components/admin/InstallPluginDialog";

export default function Plugins() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [togglingPlugin, setTogglingPlugin] = useState<string | null>(null);

  const { data: plugins, isLoading } = useQuery({
    queryKey: ["plugins"],
    queryFn: getAllPlugins,
  });

  const parsedPlugins: ParsedPlugin[] = (plugins || []).map(parsePlugin);
  const registeredModules = getRegisteredPluginModules();

  const toggleMutation = useMutation({
    mutationFn: async ({ name, activate }: { name: string; activate: boolean }) => {
      if (activate) {
        return activatePlugin(name);
      } else {
        return deactivatePlugin(name);
      }
    },
    onMutate: ({ name }) => {
      setTogglingPlugin(name);
    },
    onSuccess: (success, { name, activate }) => {
      if (success) {
        toast({
          title: activate ? "Плагін активовано" : "Плагін деактивовано",
          description: `Плагін "${name}" ${activate ? "активовано" : "деактивовано"} успішно.`,
        });
        queryClient.invalidateQueries({ queryKey: ["plugins"] });
      } else {
        toast({
          title: "Помилка",
          description: "Не вдалося змінити статус плагіна.",
          variant: "destructive",
        });
      }
    },
    onSettled: () => {
      setTogglingPlugin(null);
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: uninstallPlugin,
    onSuccess: (success, name) => {
      if (success) {
        toast({
          title: "Плагін видалено",
          description: `Плагін "${name}" успішно видалено.`,
        });
        queryClient.invalidateQueries({ queryKey: ["plugins"] });
      } else {
        toast({
          title: "Помилка",
          description: "Не вдалося видалити плагін.",
          variant: "destructive",
        });
      }
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <NavLink to="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </NavLink>
          <div>
            <h1 className="text-2xl font-bold">Розширення</h1>
            <p className="text-muted-foreground">
              Керування плагінами та модулями системи
            </p>
          </div>
        </div>
        <InstallPluginDialog />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : parsedPlugins.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Puzzle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Немає встановлених плагінів</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Плагіни дозволяють розширювати функціональність системи. 
              Встановіть плагін, щоб додати нові можливості.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {parsedPlugins.map((plugin) => {
            const hasModule = registeredModules.has(plugin.name);
            const isToggling = togglingPlugin === plugin.name;

            return (
              <Card key={plugin.id} className={!plugin.is_active ? "opacity-75" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Puzzle className="h-4 w-4" />
                        {plugin.display_name}
                      </CardTitle>
                      <CardDescription>{plugin.description || "Без опису"}</CardDescription>
                    </div>
                    <Switch
                      checked={plugin.is_active}
                      disabled={isToggling || !hasModule}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ name: plugin.name, activate: checked })
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">v{plugin.version}</Badge>
                    {plugin.author && (
                      <Badge variant="secondary">{plugin.author}</Badge>
                    )}
                    {!hasModule && (
                      <Badge variant="destructive">Модуль не знайдено</Badge>
                    )}
                    {plugin.is_active && (
                      <Badge variant="default">Активний</Badge>
                    )}
                  </div>

                  {plugin.hooks.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Хуки:</span>{" "}
                      {plugin.hooks.map((h) => h.name).join(", ")}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <NavLink to={`/admin/plugins/${plugin.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Settings className="h-4 w-4 mr-2" />
                        Налаштування
                      </Button>
                    </NavLink>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Видалити плагін?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Плагін "{plugin.display_name}" буде видалено. Цю дію неможливо скасувати.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Скасувати</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => uninstallMutation.mutate(plugin.name)}
                          >
                            Видалити
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Доступні модулі</CardTitle>
          <CardDescription>
            Зареєстровані модулі плагінів у системі
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registeredModules.size === 0 ? (
            <p className="text-muted-foreground">
              Немає зареєстрованих модулів. Модулі реєструються при завантаженні застосунку.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Array.from(registeredModules.keys()).map((name) => (
                <Badge key={name} variant="outline">
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
