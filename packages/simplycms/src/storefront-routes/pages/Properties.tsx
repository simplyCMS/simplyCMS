import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Loader2, ChevronRight, Tag } from 'lucide-react';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { PropertyWithOptions } from 'simplycms/storefront/loaders';
import { getProperties } from '../server/properties';

const sectionProperties = entityKey(ENTITY.sectionProperties);

export interface PropertiesPageProps {
  properties?: PropertyWithOptions[];
}

export default function PropertiesPage({
  properties: initialProperties,
}: PropertiesPageProps = {}) {
  const t = useT();

  /**
   * 🔴 Один запит замість двох. Кількість значень більше не окремий похід у
   * БД по ВСІХ опціях магазину: серверний лоадер віддає характеристику разом
   * з її опціями, тож лічильник — це довжина вже наявного масиву.
   */
  const { data: properties, isLoading } = useQuery({
    queryKey: sectionProperties.list(),
    queryFn: (): Promise<PropertyWithOptions[]> => getProperties(),
    initialData: initialProperties,
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
          {t('breadcrumbs.home')}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{t('properties.title')}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{t('properties.pageTitle')}</h1>
        <p className="text-muted-foreground">{t('properties.subtitle')}</p>
      </div>

      {/* Properties grid */}
      {properties && properties.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {properties.map((property) => (
            <Link
              key={property.id}
              to="/properties/$propertySlug"
              params={{ propertySlug: property.slug }}
            >
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
                    {t('properties.optionCount', {
                      count: property.property_options.length,
                    })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <p className="text-muted-foreground">{t('properties.empty')}</p>
        </div>
      )}
    </div>
  );
}
