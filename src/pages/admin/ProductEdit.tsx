import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { ProductPropertyValues } from "@/components/admin/ProductPropertyValues";
import { ProductModifications } from "@/components/admin/ProductModifications";
import { SimpleProductFields } from "@/components/admin/SimpleProductFields";
import { AllProductProperties } from "@/components/admin/AllProductProperties";
import { PluginSlot } from "@/components/plugins/PluginSlot";

export default function ProductEdit() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNew = productId === "new";

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    short_description: "",
    description: "",
    meta_title: "",
    meta_description: "",
    section_id: "",
    is_active: true,
    is_featured: false,
    has_modifications: true,
    sku: "",
    stock_status: "in_stock" as "in_stock" | "out_of_stock" | "on_order",
  });
  const [images, setImages] = useState<string[]>([]);

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  const { data: sections } = useQuery({
    queryKey: ["admin-sections-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        slug: product.slug || "",
        short_description: product.short_description || "",
        description: product.description || "",
        meta_title: product.meta_title || "",
        meta_description: product.meta_description || "",
        section_id: product.section_id || "",
        is_active: product.is_active ?? true,
        is_featured: product.is_featured ?? false,
        has_modifications: (product as any).has_modifications ?? true,
        sku: (product as any).sku || "",
        stock_status: (product as any).stock_status || "in_stock",
      });
      const productImages = (product as any).images;
      setImages(Array.isArray(productImages) ? productImages : []);
    }
  }, [product]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: newProduct, error } = await supabase
        .from("products")
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return newProduct;
    },
    onSuccess: (newProduct) => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Товар створено" });
      navigate(`/admin/products/${newProduct.id}`);
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("products")
        .update(data)
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      toast({ title: "Товар оновлено" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Помилка", description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      name: formData.name,
      slug: formData.slug,
      short_description: formData.short_description,
      description: formData.description,
      meta_title: formData.meta_title,
      meta_description: formData.meta_description,
      section_id: formData.section_id || null,
      is_active: formData.is_active,
      is_featured: formData.is_featured,
      has_modifications: formData.has_modifications,
      images,
    };

    // Only include stock fields for simple products
    if (!formData.has_modifications) {
      data.sku = formData.sku || null;
      data.stock_status = formData.stock_status;
    } else {
      data.sku = null;
      data.stock_status = "in_stock";
    }

    if (isNew) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!isNew && productLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/products")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isNew ? "Новий товар" : formData.name || "Редагування товару"}
            </h1>
            <p className="text-muted-foreground">
              {isNew ? "Створіть новий товар" : "Редагуйте інформацію про товар"}
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isNew ? "Створити" : "Зберегти"}
        </Button>
      </div>

      {/* Plugin slot: before product form */}
      <PluginSlot 
        name="admin.product.form.before" 
        context={{ product, formData, isNew, productId }} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Основна інформація</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Назва *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL (slug) *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => handleChange("slug", e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="short_description">Короткий опис</Label>
                <Input
                  id="short_description"
                  value={formData.short_description}
                  onChange={(e) => handleChange("short_description", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Повний опис</Label>
                <RichTextEditor
                  content={formData.description}
                  onChange={(content) => handleChange("description", content)}
                  placeholder="Введіть опис товару..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Зображення товару</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUpload
                images={images}
                onImagesChange={setImages}
                folder={`products/${productId || "new"}`}
                maxImages={10}
              />
            </CardContent>
          </Card>

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
                <Textarea
                  id="meta_description"
                  rows={3}
                  value={formData.meta_description}
                  onChange={(e) => handleChange("meta_description", e.target.value)}
                  placeholder="Опис для пошукових систем"
                />
              </div>
            </CardContent>
          </Card>

          {/* Plugin slot: additional form fields from plugins */}
          <PluginSlot 
            name="admin.product.form.fields" 
            context={{ product, formData, isNew, productId, handleChange }} 
          />

          {/* Simple product fields - only for simple products */}
          {!isNew && !formData.has_modifications && (
            <SimpleProductFields
              productId={productId!}
              sku={formData.sku}
              stockStatus={formData.stock_status}
              onSkuChange={(v) => handleChange("sku", v)}
              onStockStatusChange={(v) => handleChange("stock_status", v)}
            />
          )}

          {/* All properties - for simple products (combines product + modification level) */}
          {!isNew && formData.section_id && !formData.has_modifications && (
            <AllProductProperties
              productId={productId!}
              sectionId={formData.section_id}
            />
          )}

          {/* Property Values - only show for existing products with modifications */}
          {!isNew && formData.section_id && formData.has_modifications && (
            <ProductPropertyValues
              productId={productId!}
              sectionId={formData.section_id}
            />
          )}

          {/* Modifications - only show for products with modifications */}
          {!isNew && formData.has_modifications && (
            <ProductModifications productId={productId!} sectionId={formData.section_id} />
          )}

          {/* Plugin slot: after main form content */}
          <PluginSlot 
            name="admin.product.form.after" 
            context={{ product, formData, isNew, productId }} 
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Налаштування</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Розділ *</Label>
                <Select
                  value={formData.section_id}
                  onValueChange={(value) => handleChange("section_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Виберіть розділ" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections?.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Тип товару</Label>
                <RadioGroup
                  value={formData.has_modifications ? "with_modifications" : "simple"}
                  onValueChange={(value) => handleChange("has_modifications", value === "with_modifications")}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="simple" id="type_simple" />
                    <Label htmlFor="type_simple" className="font-normal cursor-pointer">
                      Простий товар
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="with_modifications" id="type_modifications" />
                    <Label htmlFor="type_modifications" className="font-normal cursor-pointer">
                      Товар з модифікаціями
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Активний</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleChange("is_active", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_featured">Рекомендований</Label>
                <Switch
                  id="is_featured"
                  checked={formData.is_featured}
                  onCheckedChange={(checked) => handleChange("is_featured", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Plugin slot: sidebar items from plugins */}
          <PluginSlot 
            name="admin.product.form.sidebar" 
            context={{ product, formData, isNew, productId }} 
          />

          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle>Інформація</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>ID: {productId}</p>
                {product && (
                  <>
                    <p>
                      Створено:{" "}
                      {new Date(product.created_at).toLocaleDateString("uk-UA")}
                    </p>
                    <p>
                      Оновлено:{" "}
                      {new Date(product.updated_at).toLocaleDateString("uk-UA")}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
