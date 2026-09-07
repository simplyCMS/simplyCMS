import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Palette } from "lucide-react";
import { useState, useEffect } from "react";

interface ThemeSetting {
  type: "color" | "boolean" | "select" | "text" | "number";
  default: string | boolean | number;
  label: string;
  description?: string;
  options?: Array<{ value: string; label: string }>;
}

interface ThemeRecord {
  id: string;
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  config: Record<string, unknown>;
  settings_schema: Record<string, ThemeSetting>;
}

export default function ThemeSettings() {
  const { themeId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<Record<string, unknown>>({});

  const { data: theme, isLoading } = useQuery({
    queryKey: ["admin-theme", themeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("themes")
        .select("*")
        .eq("id", themeId)
        .single();
      if (error) throw error;
      
      const configData = data.config as Record<string, unknown> | null;
      const schemaData = data.settings_schema as Record<string, unknown> | null;
      
      return {
        ...data,
        config: configData || {},
        settings_schema: (schemaData || {}) as Record<string, ThemeSetting>,
      } as ThemeRecord;
    },
  });

  useEffect(() => {
    if (theme) {
      const defaults: Record<string, unknown> = {};
      Object.entries(theme.settings_schema).forEach(([key, setting]) => {
        defaults[key] = setting.default;
      });
      setConfig({ ...defaults, ...theme.config });
    }
  }, [theme]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("themes")
        .update({ config: config as never })
        .eq("id", themeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-theme", themeId] });
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
        <Button onClick={() => navigate("/admin/themes")}>Повернутись</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/themes">
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
          {Object.entries(theme.settings_schema).map(([key, setting]) => (
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
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
