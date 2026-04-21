import { Link } from '@tanstack/react-router';
import { useQuery } from "@tanstack/react-query";
import {
  Battery,
  Zap,
  Sun,
  Wrench,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@simplycms/ui/button";
import { Card, CardContent } from "@simplycms/ui/card";
import { supabase } from "@simplycms/core/supabase/client";
import useEmblaCarousel from "embla-carousel-react";

/** Категорії товарів для героїв-секції */
const categories = [
  {
    icon: Battery,
    title: "Акумулятори",
    description: "Літієві, гелеві та AGM акумулятори",
    color: "from-blue-500 to-blue-600",
  },
  {
    icon: Zap,
    title: "Інвертори",
    description: "Мережеві та автономні інвертори",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Sun,
    title: "Сонячні панелі",
    description: "Моно та полікристалічні панелі",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: Wrench,
    title: "Послуги монтажу",
    description: "Професійна установка обладнання",
    color: "from-purple-500 to-violet-500",
  },
];

/** Переваги компанії */
const advantages = [
  { value: "5+", label: "років досвіду" },
  { value: "1000+", label: "встановлених систем" },
  { value: "24/7", label: "підтримка клієнтів" },
  { value: "3", label: "роки гарантії" },
];

export default function HomePage() {
  /** Рекомендовані товари */
  const { data: featuredProducts } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(
          "id, name, slug, images, short_description, stock_status, is_featured, section_id, sections!products_section_id_fkey(slug)"
        )
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(12);

      if (!data) return [];
      return data.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        images: (p.images as string[]) || [],
        short_description: p.short_description,
        stock_status: p.stock_status,
        section: p.sections ? { slug: (p.sections as { slug: string }).slug } : null,
      }));
    },
  });

  /** Нові товари */
  const { data: newProducts } = useQuery({
    queryKey: ["new-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(
          "id, name, slug, images, short_description, stock_status, section_id, sections!products_section_id_fkey(slug)"
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(12);

      if (!data) return [];
      return data.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        images: (p.images as string[]) || [],
        short_description: p.short_description,
        stock_status: p.stock_status,
        section: p.sections ? { slug: (p.sections as { slug: string }).slug } : null,
      }));
    },
  });

  /** Кореневі секції для каруселей за категоріями */
  const { data: rootSections } = useQuery({
    queryKey: ["root-sections"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sections")
        .select("id, name, slug")
        .eq("is_active", true)
        .is("parent_id", null)
        .order("sort_order");
      return data || [];
    },
  });

  return (
    <>
      {/* Hero секція */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))]/10 to-[hsl(var(--primary))]/5" />
        <div className="container mx-auto px-4 relative">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-5xl md:text-6xl">
              Енергетична{" "}
              <span className="text-[hsl(var(--primary))]">незалежність</span>{" "}
              для вашого дому
            </h1>
            <p className="mt-6 text-lg text-[hsl(var(--muted-foreground))] md:text-xl">
              Професійні рішення з альтернативної енергетики: акумулятори,
              інвертори, сонячні панелі та послуги монтажу під ключ
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Button
                size="lg"
                className="bg-[hsl(var(--primary))] text-white border-0 h-12 px-8 hover:bg-[hsl(var(--primary))]/90"
                asChild
              >
                <Link to="/catalog">
                  Переглянути каталог
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8">
                Замовити консультацію
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Категорії */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[hsl(var(--foreground))]">
              Категорії товарів
            </h2>
            <p className="mt-3 text-[hsl(var(--muted-foreground))]">
              Оберіть потрібне обладнання для вашої енергосистеми
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Card
                key={category.title}
                className="group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <CardContent className="p-6">
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${category.color} mb-4`}
                  >
                    <category.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors">
                    {category.title}
                  </h3>
                  <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                    {category.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Рекомендовані товари */}
      {featuredProducts && featuredProducts.length > 0 && (
        <ProductCarousel
          title="Лідери продажів"
          products={featuredProducts}
          viewAllLink="/catalog"
        />
      )}

      {/* Нові товари */}
      {newProducts && newProducts.length > 0 && (
        <ProductCarousel
          title="Новинки"
          products={newProducts}
          viewAllLink="/catalog"
        />
      )}

      {/* Секції за категоріями */}
      {rootSections?.map((section) => (
        <SectionProductCarousel key={section.id} section={section} />
      ))}

      {/* Переваги */}
      <section className="py-16 md:py-24 bg-[hsl(var(--muted))]/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[hsl(var(--foreground))]">
              Чому обирають нас
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-4xl font-bold text-[hsl(var(--primary))]">
                  {item.value}
                </div>
                <div className="mt-2 text-[hsl(var(--muted-foreground))]">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA секція */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <Card className="overflow-hidden">
            <div className="relative p-8 md:p-12 bg-[hsl(var(--primary))]">
              <div className="relative z-10 max-w-2xl">
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                  Потрібна консультація?
                </h2>
                <p className="mt-4 text-white/90">
                  Наші експерти допоможуть підібрати оптимальне рішення для
                  вашого об&#39;єкту
                </p>
                <Button size="lg" variant="secondary" className="mt-6">
                  Замовити дзвінок
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}

/* ---- Допоміжні компоненти ---- */

interface Product {
  id: string;
  name: string;
  slug: string;
  short_description?: string | null;
  images?: string[];
  section?: { slug: string } | null;
  stock_status?: string | null;
}

/** Карусель товарів */
function ProductCarousel({
  title,
  products,
  viewAllLink,
}: {
  title: string;
  products: Product[];
  viewAllLink?: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    slidesToScroll: 1,
  });

  if (!products.length) return null;

  return (
    <section className="py-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[hsl(var(--foreground))] uppercase tracking-wider">
            {title}
          </h2>
          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="text-sm text-[hsl(var(--primary))] hover:underline font-medium"
            >
              Переглянути усі &rarr;
            </Link>
          )}
        </div>

        <div className="relative group">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex-[0_0_calc(50%-8px)] sm:flex-[0_0_calc(33.333%-11px)] lg:flex-[0_0_calc(25%-12px)] min-w-0"
                >
                  <SolarProductCard product={product} />
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="absolute -left-3 top-1/3 -translate-y-1/2 bg-[hsl(var(--background))]/80 hover:bg-[hsl(var(--background))] rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity h-9 w-9"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-1/3 -translate-y-1/2 bg-[hsl(var(--background))]/80 hover:bg-[hsl(var(--background))] rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity h-9 w-9"
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Картка товару SolarStore */
function SolarProductCard({ product }: { product: Product }) {
  const href = product.section
    ? `/catalog/${product.section.slug}/${product.slug}`
    : `/catalog/${product.slug}`;

  const imageUrl =
    product.images && product.images.length > 0
      ? product.images[0]
      : "/placeholder.svg";

  return (
    <Link to={href} className="block group">
      <Card className="overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
        <div className="relative aspect-square overflow-hidden bg-[hsl(var(--muted))]">
          <img
            src={imageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-[hsl(var(--foreground))] line-clamp-2 group-hover:text-[hsl(var(--primary))] transition-colors">
            {product.name}
          </h3>
          {product.short_description && (
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] line-clamp-1">
              {product.short_description}
            </p>
          )}
          {product.stock_status === "in_stock" && (
            <span className="mt-2 inline-block text-xs font-medium text-green-600">
              В наявності
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

/** Карусель товарів за секцією */
function SectionProductCarousel({
  section,
}: {
  section: { id: string; name: string; slug: string };
}) {
  const { data: products } = useQuery({
    queryKey: ["section-products", section.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, images, short_description, stock_status")
        .eq("is_active", true)
        .eq("section_id", section.id)
        .order("created_at", { ascending: false })
        .limit(8);

      if (!data) return [];
      return data.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        images: (p.images as string[]) || [],
        short_description: p.short_description,
        stock_status: p.stock_status,
        section: { slug: section.slug },
      }));
    },
  });

  if (!products?.length) return null;

  return (
    <ProductCarousel
      title={section.name}
      products={products}
      viewAllLink={`/catalog/${section.slug}`}
    />
  );
}
