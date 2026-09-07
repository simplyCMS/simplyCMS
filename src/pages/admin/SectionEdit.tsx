import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { SectionPropertiesManager } from "@/components/admin/SectionPropertiesManager";

export default function SectionEdit() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNew = sectionId === "new";

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    meta_title: "",
    meta_description: "",
    sort_order: 0,
    is_active: true,
  });
  const [sectionImage, setSectionImage] = useState<string[]>([]);

  // Fetch section data
  const { data: section, isLoading } = useQuery({
    queryKey: ["section", sectionId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .eq("id", sectionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (section) {
      setFormData({
        name: section.name || "",
        slug: section.slug || "",
        description: section.description || "",
        meta_title: section.meta_title || "",
        meta_description: section.meta_description || "",
        sort_order: section.sort_order || 0,
        is_active: section.is_active ?? true,
      });
      setSectionImage(section.image_url ? [section.image_url] : []);
    }
  }, [section]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        meta_title: formData.meta_title || null,
        meta_description: formData.meta_description || null,
        image_url: sectionImage.length > 0 ? sectionImage[0] : null,
        is_active: formData.is_active,
        sort_order: formData.sort_order,
      };

      if (isNew) {
        const { error } = await supabase.from("sections").insert([data]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sections")
          .update(data)
          .eq("id", sectionId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sections"] });
      queryClient.invalidateQueries({ queryKey: ["section", sectionId] });
      toast({ title: isNew ? "Розділ створено" : "Розділ збережено" });
      if (isNew) {
        navigate("/admin/sections");
      }
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/sections")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isNew ? "Новий розділ" : formData.name || "Редагування розділу"}
            </h1>
            <p className="text-muted-foreground">
              {isNew ? "Створення нового розділу каталогу" : `Редагування розділу`}
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Зберегти
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Основна інформація</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Назва</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">URL (slug)</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => handleChange("slug", e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Опис</Label>
                  <RichTextEditor
                    content={formData.description}
                    onChange={(content) => handleChange("description", content)}
                    placeholder="Введіть опис розділу..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* SEO */}
            <Card>
              <CardHeader>
                <CardTitle>SEO</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="meta_title">Meta Title</Label>
                  <Input
                    id="meta_title"
                    value={formData.meta_title}
                    onChange={(e) => handleChange("meta_title", e.target.value)}
                    placeholder="Заголовок для пошукових систем"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_description">Meta Description</Label>
                  <Input
                    id="meta_description"
                    value={formData.meta_description}
                    onChange={(e) => handleChange("meta_description", e.target.value)}
                    placeholder="Опис для пошукових систем"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Налаштування</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Активний</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => handleChange("is_active", checked)}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Порядок сортування</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => handleChange("sort_order", parseInt(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Зображення</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageUpload
                  images={sectionImage}
                  onImagesChange={setSectionImage}
                  folder="sections"
                  maxImages={1}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Properties Section - only for existing sections */}
        {!isNew && sectionId && (
          <Card>
            <CardHeader>
              <CardTitle>Властивості розділу</CardTitle>
              <p className="text-sm text-muted-foreground">
                Налаштуйте які властивості доступні для товарів та модифікацій в цьому розділі
              </p>
            </CardHeader>
            <CardContent>
              <SectionPropertiesManager sectionId={sectionId} />
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
