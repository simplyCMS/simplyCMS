import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Power, PowerOff, Plug, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { parsePlugin, type ParsedPlugin, type PluginSettingDefinition } from "@/lib/plugins/types";

export default function PluginSettings() {
  const { pluginId } = useParams<{ pluginId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<Record<string, unknown>>({});

  const { data: plugin, isLoading } = useQuery({
    queryKey: ["plugin", pluginId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plugins")
        .select("*")
        .eq("id", pluginId)
        .single();
      if (error) throw error;
      return parsePlugin(data);
    },
  });

  // Load plugin manifest to get settings definitions
  const { data: manifest } = useQuery({
    queryKey: ["plugin-manifest", plugin?.name],
    queryFn: async () => {
      if (!plugin?.name) return null;
      try {
        const module = await import(`../../plugins/${plugin.name}/manifest.json`);
        return module.default || module;
      } catch {
        return null;
      }
    },
    enabled: !!plugin?.name,
  });

  useEffect(() => {
    if (plugin?.config) {
      setConfig(plugin.config);
    }
  }, [plugin]);

  const toggleMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const { error } = await supabase
        .from("plugins")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", pluginId);
      if (error) throw error;
    },
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey: ["plugin", pluginId] });
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
      toast({
        title: isActive ? "Розширення активовано" : "Розширення деактивовано",
      });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newConfig: Record<string, unknown>) => {
      const { error } = await supabase
        .from("plugins")
        .update({ config: newConfig as unknown as Record<string, never>, updated_at: new Date().toISOString() })
        .eq("id", pluginId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugin", pluginId] });
      toast({ title: "Налаштування збережено" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!plugin) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Розширення не знайдено</p>
        <Button variant="link" onClick={() => navigate("/admin/plugins")}>
          Повернутися до списку
        </Button>
      </div>
    );
  }

  const settings = manifest?.settings as Record<string, PluginSettingDefinition> | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/plugins")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Plug className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">{plugin.display_name}</h1>
                <Badge variant={plugin.is_active ? "default" : "secondary"}>
                  {plugin.is_active ? "Активне" : "Неактивне"}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                v{plugin.version} {plugin.author && `• ${plugin.author}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={plugin.is_active ? "outline" : "default"}
            onClick={() => toggleMutation.mutate(!plugin.is_active)}
            disabled={toggleMutation.isPending}
          >
            {toggleMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : plugin.is_active ? (
              <PowerOff className="h-4 w-4 mr-2" />
            ) : (
              <Power className="h-4 w-4 mr-2" />
            )}
            {plugin.is_active ? "Деактивувати" : "Активувати"}
          </Button>
          {settings && Object.keys(settings).length > 0 && (
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Зберегти
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {plugin.description && (
            <Card>
              <CardHeader>
                <CardTitle>Опис</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{plugin.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Settings */}
          {settings && Object.keys(settings).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Налаштування
                </CardTitle>
                <CardDescription>
                  Налаштуйте параметри роботи розширення
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(settings).map(([key, setting]) => (
                  <div key={key} className="space-y-2">
                    {setting.type === "boolean" ? (
                      <div className="flex items-center justify-between">
                        <Label htmlFor={key}>{setting.label}</Label>
                        <Switch
                          id={key}
                          checked={Boolean(config[key] ?? setting.default)}
                          onCheckedChange={(checked) => handleConfigChange(key, checked)}
                        />
                      </div>
                    ) : setting.type === "select" ? (
                      <>
                        <Label htmlFor={key}>{setting.label}</Label>
                        <Select
                          value={(config[key] as string) ?? String(setting.default)}
                          onValueChange={(value) => handleConfigChange(key, value)}
                        >
                          <SelectTrigger id={key}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {setting.options?.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : setting.type === "number" ? (
                      <>
                        <Label htmlFor={key}>{setting.label}</Label>
                        <Input
                          id={key}
                          type="number"
                          value={String(config[key] ?? setting.default ?? "")}
                          onChange={(e) => handleConfigChange(key, parseFloat(e.target.value))}
                        />
                      </>
                    ) : (
                      <>
                        <Label htmlFor={key}>{setting.label}</Label>
                        <Input
                          id={key}
                          value={String(config[key] ?? setting.default ?? "")}
                          onChange={(e) => handleConfigChange(key, e.target.value)}
                        />
                      </>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Налаштування
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-4">
                  Це розширення не має налаштувань
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Hooks */}
          <Card>
            <CardHeader>
              <CardTitle>Зареєстровані хуки</CardTitle>
              <CardDescription>
                Точки розширення, які використовує плагін
              </CardDescription>
            </CardHeader>
            <CardContent>
              {plugin.hooks.length > 0 ? (
                <div className="space-y-2">
                  {plugin.hooks.map((hook, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <code className="text-sm">{hook.name}</code>
                      {hook.priority !== undefined && (
                        <Badge variant="outline" className="text-xs">
                          {hook.priority}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Немає зареєстрованих хуків
                </p>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle>Інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-xs">{plugin.id.slice(0, 8)}...</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Назва</span>
                <span className="font-mono">{plugin.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Версія</span>
                <span>{plugin.version}</span>
              </div>
              {plugin.author && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Автор</span>
                    <span>{plugin.author}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Встановлено</span>
                <span>{new Date(plugin.installed_at).toLocaleDateString("uk-UA")}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Оновлено</span>
                <span>{new Date(plugin.updated_at).toLocaleDateString("uk-UA")}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
