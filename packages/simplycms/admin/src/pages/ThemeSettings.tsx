import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabaseClient } from "@simplysoftua/core/supabase/SupabaseProvider";
import { ThemeRegistry } from "@simplysoftua/themes/ThemeRegistry";
import { Button } from "@simplysoftua/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@simplysoftua/ui/card";
import { Input } from "@simplysoftua/ui/input";
import { Label } from "@simplysoftua/ui/label";
import { Switch } from "@simplysoftua/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@simplysoftua/ui/select";
import { Skeleton } from "@simplysoftua/ui/skeleton";
import { useToast } from "@simplysoftua/core/hooks/use-toast";
import { ArrowLeft, Save, Palette } from "lucide-react";
import { adminPath } from "../lib/adminLinks";
import { useState, useEffect } from "react";
import type { ThemeSettingDefinition } from "@simplysoftua/themes/types";

/** Виклик revalidation API після зміни налаштувань теми */
async function revalidateTheme() {
  try {
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "theme" }),
    });
  } catch {
    // Revalidation — best effort
  }
}

interface ThemeRecord {
  id: string;
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  settings: Record<string, unknown>;
}

export default function ThemeSettings() {
  const supabase = useSupabaseClient();
  const { themeId } = useParams({ strict: false }) as { themeId: string };
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [settingsSchema, setSettingsSchema] = useState<Record<string, ThemeSettingDefinition>>({});

  // Завантаження теми з БД
  const { data: theme, isLoading } = useQuery({
    queryKey: ["admin-theme", themeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("themes")
        .select("*")
        .eq("id", themeId)
        .single();
      if (error) throw error;

      const settingsData = data.settings as Record<string, unknown> | null;

      return {
        ...data,
        settings: settingsData || {},
      } as ThemeRecord;
    },
  });

  // Завантаження схеми та ініціалізація config при зміні теми
  useEffect(() => {
    if (!theme) return;
    (async () => {
      let schema: Record<string, ThemeSettingDefinition> = {};
      if (ThemeRegistry.has(theme.name)) {
        const themeModule = await ThemeRegistry.load(theme.name);
        schema = themeModule.manifest.settings || {};
      }
      setSettingsSchema(schema);

      // Ініціалізація config з defaults + збережених settings (після await)
      const defaults: Record<string, unknown> = {};
      Object.entries(schema).forEach(([key, setting]) => {
        defaults[key] = setting.default;
      });
      setConfig({ ...defaults, ...theme.settings });
    })();
  }, [theme]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("themes")
        .update({ settings: config as never })
        .eq("id", themeId);
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["admin-theme", themeId] });
      await revalidateTheme();
      toast({ title: "Налаштування збережено" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Помилка збереження" });
    },
  });

  const handleChange = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-64" /></div>;
  }

  if (!theme) {
    return (
      <div className="text-center py-12">
        <Palette className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Тему не знайдено</h2>
        <Button onClick={() => navigate({ to: adminPath('themes') })}>Повернутись</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={adminPath("themes")}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{theme.display_name}</h1>
            <p className="text-muted-foreground">v{theme.version}</p>
          </div>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />Зберегти
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Налаштування</CardTitle>
          <CardDescription>Налаштуйте зовнішній вигляд теми</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.keys(settingsSchema).length === 0 ? (
            <p className="text-muted-foreground">Ця тема не має налаштувань</p>
          ) : (
            Object.entries(settingsSchema).map(([key, setting]) => (
              <div key={key} className="space-y-2">
                <Label>{setting.label}</Label>

                {setting.type === "boolean" && (
                  <Switch
                    checked={Boolean(config[key] ?? setting.default)}
                    onCheckedChange={(checked) => handleChange(key, checked)}
                  />
                )}

                {setting.type === "color" && (
                  <Input
                    type="color"
                    value={String(config[key] ?? setting.default)}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="w-16 h-10"
                  />
                )}

                {setting.type === "select" && setting.options && (
                  <Select
                    value={String(config[key] ?? setting.default)}
                    onValueChange={(value) => handleChange(key, value)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {setting.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
