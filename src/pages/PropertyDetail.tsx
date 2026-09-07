import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight } from "lucide-react";

export default function PropertyDetail() {
  const { propertySlug } = useParams<{ propertySlug: string }>();

  // Fetch property by slug
  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ["property-by-slug-detail", propertySlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_properties")
        .select("*")
        .eq("slug", propertySlug!)
        .eq("has_page", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!propertySlug,
  });

  // Fetch options for this property
  const { data: options, isLoading: optionsLoading } = useQuery({
    queryKey: ["property-options-public", property?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_options")
        .select("*")
        .eq("property_id", property!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!property?.id,
  });

  if (propertyLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Властивість не знайдено</h1>
        <Link to="/properties">
          <Button>Повернутись до властивостей</Button>
        </Link>
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
        <Link to="/properties" className="hover:text-foreground transition-colors">
          Властивості
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{property.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{property.name}</h1>
        <p className="text-muted-foreground">
          Оберіть значення для перегляду товарів
        </p>
      </div>

      {/* Options grid */}
      {optionsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : options && options.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {options.map((option) => (
            <Link
              key={option.id}
              to={`/properties/${property.slug}/${option.slug}`}
            >
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden">
                {option.image_url && (
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={option.image_url}
                      alt={option.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <CardContent className={option.image_url ? "pt-3" : "pt-6"}>
                  <p className="font-medium text-center group-hover:text-primary transition-colors">
                    {option.name}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <p className="text-muted-foreground">
            Значень для цієї властивості поки немає
          </p>
        </div>
      )}
    </div>
  );
}
