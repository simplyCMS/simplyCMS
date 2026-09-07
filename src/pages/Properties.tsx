import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ChevronRight, Tag } from "lucide-react";

export default function Properties() {
  // Fetch properties with has_page = true
  const { data: properties, isLoading } = useQuery({
    queryKey: ["public-properties-with-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_properties")
        .select("*")
        .eq("has_page", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch option counts for each property
  const { data: optionCounts } = useQuery({
    queryKey: ["property-option-counts", properties?.map(p => p.id)],
    queryFn: async () => {
      if (!properties?.length) return {};
      
      const { data, error } = await supabase
        .from("property_options")
        .select("property_id");
      
      if (error) throw error;
      
      // Count options per property
      const counts: Record<string, number> = {};
      data?.forEach(opt => {
        counts[opt.property_id] = (counts[opt.property_id] || 0) + 1;
      });
      
      return counts;
    },
    enabled: !!properties?.length,
  });

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors">
          Головна
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Властивості</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Властивості товарів</h1>
        <p className="text-muted-foreground">
          Перегляньте товари за характеристиками
        </p>
      </div>

      {/* Properties grid */}
      {properties && properties.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {properties.map((property) => (
            <Link key={property.id} to={`/properties/${property.slug}`}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Tag className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{property.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {optionCounts?.[property.id] || 0} значень
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <p className="text-muted-foreground">
            Властивостей із сторінками поки немає
          </p>
        </div>
      )}
    </div>
  );
}
