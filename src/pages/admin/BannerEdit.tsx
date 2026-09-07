import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";

interface BannerButton {
  text: string;
  url: string;
  target: "_self" | "_blank";
  variant: "primary" | "secondary" | "outline";
}

interface BannerForm {
  title: string;
  subtitle: string;
  image_url: string;
  desktop_image_url: string;
  mobile_image_url: string;
  placement: string;
  section_id: string;
  buttons: BannerButton[];
  date_from: string;
  date_to: string;
  schedule_days: number[];
  schedule_time_from: string;
  schedule_time_to: string;
  slide_duration: number;
  animation_type: string;
  animation_duration: number;
  overlay_color: string;
  text_position: string;
  sort_order: number;
  is_active: boolean;
}

const DAYS = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Нд" },
];

const defaultForm: BannerForm = {
  title: "",
  subtitle: "",
  image_url: "",
  desktop_image_url: "",
  mobile_image_url: "",
  placement: "home",
  section_id: "",
  buttons: [],
  date_from: "",
  date_to: "",
  schedule_days: [],
  schedule_time_from: "",
  schedule_time_to: "",
  slide_duration: 5000,
  animation_type: "slide",
  animation_duration: 500,
  overlay_color: "rgba(0,0,0,0.4)",
  text_position: "left",
  sort_order: 0,
  is_active: true,
};

export default function BannerEdit() {
  const { bannerId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNew = !bannerId || bannerId === "new";

  const [form, setForm] = useState<BannerForm>(defaultForm);

  const { data: banner, isLoading } = useQuery({
    queryKey: ["admin-banner", bannerId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase.from("banners").select("*").eq("id", bannerId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  const { data: sections } = useQuery({
    queryKey: ["admin-sections-list"],
    queryFn: async () => {
      const { data } = await supabase.from("sections").select("id, name").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  useEffect(() => {
    if (banner) {
      setForm({
        title: banner.title || "",
        subtitle: banner.subtitle || "",
        image_url: banner.image_url || "",
        desktop_image_url: banner.desktop_image_url || "",
        mobile_image_url: banner.mobile_image_url || "",
        placement: banner.placement || "home",
        section_id: banner.section_id || "",
        buttons: (Array.isArray(banner.buttons) ? banner.buttons : []) as unknown as BannerButton[],
        date_from: banner.date_from ? banner.date_from.slice(0, 16) : "",
        date_to: banner.date_to ? banner.date_to.slice(0, 16) : "",
        schedule_days: (banner.schedule_days as number[]) || [],
        schedule_time_from: banner.schedule_time_from || "",
        schedule_time_to: banner.schedule_time_to || "",
        slide_duration: banner.slide_duration || 5000,
        animation_type: banner.animation_type || "slide",
        animation_duration: banner.animation_duration || 500,
        overlay_color: banner.overlay_color || "rgba(0,0,0,0.4)",
        text_position: banner.text_position || "left",
        sort_order: banner.sort_order || 0,
        is_active: banner.is_active ?? true,
      });
    }
  }, [banner]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        subtitle: form.subtitle || null,
        image_url: form.image_url,
        desktop_image_url: form.desktop_image_url || null,
        mobile_image_url: form.mobile_image_url || null,
        placement: form.placement,
        section_id: form.section_id || null,
        buttons: form.buttons as any,
        date_from: form.date_from || null,
        date_to: form.date_to || null,
        schedule_days: form.schedule_days.length > 0 ? form.schedule_days : null,
        schedule_time_from: form.schedule_time_from || null,
        schedule_time_to: form.schedule_time_to || null,
        slide_duration: form.slide_duration,
        animation_type: form.animation_type,
        animation_duration: form.animation_duration,
        overlay_color: form.overlay_color || null,
        text_position: form.text_position,
        sort_order: form.sort_order,
        is_active: form.is_active,
      };

      if (isNew) {
        const { error } = await supabase.from("banners").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("banners").update(payload).eq("id", bannerId!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      toast({ title: "Банер збережено" });
      navigate("/admin/banners");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Помилка збереження" });
    },
  });

  const update = <K extends keyof BannerForm>(key: K, value: BannerForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addButton = () => {
    update("buttons", [...form.buttons, { text: "", url: "", target: "_self", variant: "primary" }]);
  };

  const updateButton = (index: number, field: keyof BannerButton, value: string) => {
    const updated = [...form.buttons];
    (updated[index] as any)[field] = value;
    update("buttons", updated);
  };

  const removeButton = (index: number) => {
    update("buttons", form.buttons.filter((_, i) => i !== index));
  };

  const toggleDay = (day: number) => {
    const days = form.schedule_days.includes(day)
      ? form.schedule_days.filter((d) => d !== day)
      : [...form.schedule_days, day];
    update("schedule_days", days);
  };

  if (isLoading) return <div className="p-6">Завантаження...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/banners")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{isNew ? "Новий банер" : "Редагування банера"}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main info */}
          <Card>
            <CardHeader><CardTitle>Основне</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Заголовок *</Label>
                <Input value={form.title} onChange={(e) => update("title", e.target.value)} />
              </div>
              <div>
                <Label>Підзаголовок</Label>
                <Input value={form.subtitle} onChange={(e) => update("subtitle", e.target.value)} />
              </div>
              <div>
                <Label>Зображення *</Label>
                <ImageUpload
                  images={form.image_url ? [form.image_url] : []}
                  onImagesChange={(imgs) => update("image_url", imgs[0] || "")}
                  bucket="banner-images"
                  folder="banners"
                  maxImages={1}
                />
              </div>
              <div>
                <Label>Десктоп зображення (опціонально)</Label>
                <ImageUpload
                  images={form.desktop_image_url ? [form.desktop_image_url] : []}
                  onImagesChange={(imgs) => update("desktop_image_url", imgs[0] || "")}
                  bucket="banner-images"
                  folder="banners/desktop"
                  maxImages={1}
                />
              </div>
              <div>
                <Label>Мобільне зображення (опціонально)</Label>
                <ImageUpload
                  images={form.mobile_image_url ? [form.mobile_image_url] : []}
                  onImagesChange={(imgs) => update("mobile_image_url", imgs[0] || "")}
                  bucket="banner-images"
                  folder="banners/mobile"
                  maxImages={1}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Позиція тексту</Label>
                  <Select value={form.text_position} onValueChange={(v) => update("text_position", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Ліворуч</SelectItem>
                      <SelectItem value="center">По центру</SelectItem>
                      <SelectItem value="right">Праворуч</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Колір оверлею</Label>
                  <Input value={form.overlay_color} onChange={(e) => update("overlay_color", e.target.value)} placeholder="rgba(0,0,0,0.4)" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Buttons */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Кнопки</CardTitle>
                <Button variant="outline" size="sm" onClick={addButton}><Plus className="h-4 w-4 mr-1" /> Додати</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.buttons.length === 0 && <p className="text-sm text-muted-foreground">Кнопок поки немає</p>}
              {form.buttons.map((btn, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Кнопка {i + 1}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeButton(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Текст</Label>
                      <Input value={btn.text} onChange={(e) => updateButton(i, "text", e.target.value)} />
                    </div>
                    <div>
                      <Label>URL</Label>
                      <Input value={btn.url} onChange={(e) => updateButton(i, "url", e.target.value)} />
                    </div>
                    <div>
                      <Label>Варіант</Label>
                      <Select value={btn.variant} onValueChange={(v) => updateButton(i, "variant", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">Primary</SelectItem>
                          <SelectItem value="secondary">Secondary</SelectItem>
                          <SelectItem value="outline">Outline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Відкриття</Label>
                      <Select value={btn.target} onValueChange={(v) => updateButton(i, "target", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_self">Поточна вкладка</SelectItem>
                          <SelectItem value="_blank">Нова вкладка</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader><CardTitle>Розклад</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Дата початку</Label>
                  <Input type="datetime-local" value={form.date_from} onChange={(e) => update("date_from", e.target.value)} />
                </div>
                <div>
                  <Label>Дата закінчення</Label>
                  <Input type="datetime-local" value={form.date_to} onChange={(e) => update("date_to", e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Дні тижня</Label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((day) => (
                    <label key={day.value} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={form.schedule_days.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                      <span className="text-sm">{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Час початку</Label>
                  <Input type="time" value={form.schedule_time_from} onChange={(e) => update("schedule_time_from", e.target.value)} />
                </div>
                <div>
                  <Label>Час закінчення</Label>
                  <Input type="time" value={form.schedule_time_to} onChange={(e) => update("schedule_time_to", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Placement */}
          <Card>
            <CardHeader><CardTitle>Розміщення</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Місце показу</Label>
                <Select value={form.placement} onValueChange={(v) => update("placement", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Головна</SelectItem>
                    <SelectItem value="catalog">Каталог</SelectItem>
                    <SelectItem value="section">Конкретний розділ</SelectItem>
                    <SelectItem value="blog">Блог</SelectItem>
                    <SelectItem value="global">Глобально</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.placement === "section" && (
                <div>
                  <Label>Розділ</Label>
                  <Select value={form.section_id} onValueChange={(v) => update("section_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Оберіть розділ" /></SelectTrigger>
                    <SelectContent>
                      {sections?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Animation */}
          <Card>
            <CardHeader><CardTitle>Анімація</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Тип анімації</Label>
                <Select value={form.animation_type} onValueChange={(v) => update("animation_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slide">Ковзання</SelectItem>
                    <SelectItem value="fade">Зникання</SelectItem>
                    <SelectItem value="zoom">Збільшення</SelectItem>
                    <SelectItem value="none">Без анімації</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Тривалість анімації: {form.animation_duration} мс</Label>
                <Slider value={[form.animation_duration]} onValueChange={([v]) => update("animation_duration", v)} min={100} max={2000} step={50} />
              </div>
              <div>
                <Label>Час показу слайду: {(form.slide_duration / 1000).toFixed(1)} с</Label>
                <Slider value={[form.slide_duration]} onValueChange={([v]) => update("slide_duration", v)} min={1000} max={15000} step={500} />
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader><CardTitle>Статус</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Активний</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => update("is_active", v)} />
              </div>
              <div>
                <Label>Порядок сортування</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => update("sort_order", parseInt(e.target.value) || 0)} />
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!form.title || !form.image_url || saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" /> Зберегти
          </Button>
        </div>
      </div>
    </div>
  );
}
