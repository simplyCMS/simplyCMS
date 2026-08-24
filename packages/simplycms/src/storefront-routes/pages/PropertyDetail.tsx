import { useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useT } from 'simplycms/i18n';
import { Card, CardContent } from 'simplycms/ui/card';
import { Button } from 'simplycms/ui/button';
import { Loader2, ChevronRight } from 'lucide-react';
import type {
  OptionRow,
  PropertyWithOptions,
} from 'simplycms/storefront/loaders';
import { getPropertyBySlug } from '../server/properties';

export interface PropertyDetailPageProps {
  property?: PropertyWithOptions;
  options?: OptionRow[];
}

export default function PropertyDetailPage({
  property: initialProperty,
  options: initialOptions,
}: PropertyDetailPageProps = {}) {
  const t = useT();
  const params = useParams({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const propertySlug = params?.propertySlug as string | undefined;

  /**
   * 🔴 Один запит замість двох: характеристика приїжджає разом з опціями, а
   * не другим походом за `property_options` після того, як приїхав її id.
   * Заодно зникає стан «характеристика вже є, опції ще ні».
   */
  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ['property-by-slug-detail', propertySlug],
    queryFn: (): Promise<PropertyWithOptions | null> =>
      getPropertyBySlug({ data: { slug: propertySlug as string } }),
    enabled: !!propertySlug,
    initialData: initialProperty,
  });

  const options: OptionRow[] =
    property?.property_options ?? initialOptions ?? [];

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
        <h1 className="text-2xl font-bold mb-4">{t('properties.notFound')}</h1>
        <Link to="/properties">
          <Button>{t('properties.backToProperties')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors">
          {t('breadcrumbs.home')}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link
          to="/properties"
          className="hover:text-foreground transition-colors"
        >
          {t('properties.title')}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{property.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{property.name}</h1>
        <p className="text-muted-foreground">{t('properties.chooseValue')}</p>
      </div>

      {/* Options grid */}
      {options.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {options.map((option) => (
            <Link
              key={option.id}
              to="/properties/$propertySlug/$optionSlug"
              params={{ propertySlug: property.slug, optionSlug: option.slug }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden">
                {option.image_url && (
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      src={option.image_url}
                      alt={option.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
                <CardContent className={option.image_url ? 'pt-3' : 'pt-6'}>
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
            {t('properties.optionsEmpty')}
          </p>
        </div>
      )}
    </div>
  );
}
