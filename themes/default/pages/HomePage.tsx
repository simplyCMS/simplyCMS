import { useQuery } from "@tanstack/react-query";
import { useSupabaseClient } from "@simplycms/supabase/SupabaseProvider";
import { BannerSlider } from "../components/BannerSlider";
import { BrandCarousel } from "../components/BrandCarousel";
import { ProductCarousel } from "../components/ProductCarousel";
import { NewsletterSection } from "../components/NewsletterSection";
import { BlogPreview } from "../components/BlogPreview";
import { useThemeSettings } from "@simplycms/core/hooks/useThemeSettings";
import type { Banner } from "@simplycms/core/hooks/useBanners";
import type { Enums } from "@simplycms/supabase";

/** Продукт для головної сторінки (мінімальний набір полів) */
interface HomeProduct {
  id: string;
  name: string;
  slug: string;
  images: string[];
  short_description: string | null;
  stock_status: Enums<'stock_status'> | null;
  section: { slug: string } | null;
}

interface HomePageProps {
  banners?: Banner[];
  featuredProducts?: HomeProduct[];
  newProducts?: HomeProduct[];
  sections?: Array<{ id: string; name: string; slug: string }>;
}

export default function HomePage({
  banners,
  featuredProducts: initialFeatured,
  newProducts: initialNew,
  sections: initialSections,
}: HomePageProps) {
  const supabase = useSupabaseClient();
  const showBrands = useThemeSettings<boolean>("showBrandCarousel");

  const { data: featuredProducts } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, images, short_description, stock_status, is_featured, section_id, sections!products_section_id_fkey(slug)")
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
    initialData: initialFeatured,
  });

  const { data: newProducts } = useQuery({
    queryKey: ["new-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, images, short_description, stock_status, section_id, sections!products_section_id_fkey(slug)")
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
    initialData: initialNew,
  });

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
    initialData: initialSections,
  });

  return (
    <>
      <BannerSlider banners={banners} />

      {showBrands !== false && <BrandCarousel />}

      {featuredProducts && featuredProducts.length > 0 && (
        <ProductCarousel
          title="Лідери продажів"
          products={featuredProducts}
          viewAllLink="/catalog"
        />
      )}

      {newProducts && newProducts.length > 0 && (
        <ProductCarousel
          title="Новинки"
          products={newProducts}
          viewAllLink="/catalog"
        />
      )}

      {rootSections?.map((section) => (
        <SectionProductCarousel key={section.id} section={section} />
      ))}

      <NewsletterSection />
      <BlogPreview />
    </>
  );
}

function SectionProductCarousel({ section }: { section: { id: string; name: string; slug: string } }) {
  const supabase = useSupabaseClient();
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
