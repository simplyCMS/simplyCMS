import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { BannerSlider } from "../components/BannerSlider";
import { BrandCarousel } from "../components/BrandCarousel";
import { ProductCarousel } from "../components/ProductCarousel";
import { NewsletterSection } from "../components/NewsletterSection";
import { BlogPreview } from "../components/BlogPreview";
import { useThemeSettings } from "@/lib/themes";

export default function HomePage() {
  const showBrands = useThemeSettings<boolean>("showBrandCarousel");

  // Fetch featured / recent products
  const { data: featuredProducts } = useQuery({
    queryKey: ["beauty-featured-products"],
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
        section: p.sections ? { slug: (p.sections as any).slug } : null,
      }));
    },
  });

  const { data: newProducts } = useQuery({
    queryKey: ["beauty-new-products"],
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
        section: p.sections ? { slug: (p.sections as any).slug } : null,
      }));
    },
  });

  // Fetch root sections for per-category carousels
  const { data: rootSections } = useQuery({
    queryKey: ["beauty-root-sections"],
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
    <div className="beauty-theme min-h-screen bg-[hsl(var(--background))]">
      <Header />

      <BannerSlider />

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

      <Footer />
    </div>
  );
}

function SectionProductCarousel({ section }: { section: { id: string; name: string; slug: string } }) {
  const { data: products } = useQuery({
    queryKey: ["beauty-section-products", section.id],
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
