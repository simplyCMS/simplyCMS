import { Link } from "react-router-dom";

interface PropertyValue {
  property_id: string;
  value: string | null;
  numeric_value: number | null;
  option_id?: string | null;
  option?: {
    id: string;
    slug: string;
  } | null;
  property?: {
    id: string;
    name: string;
    slug: string;
    property_type: string;
    has_page?: boolean;
  };
}

interface ProductCharacteristicsProps {
  propertyValues: PropertyValue[];
}

export function ProductCharacteristics({ propertyValues }: ProductCharacteristicsProps) {
  const displayableValues = propertyValues.filter(
    (pv) => pv.property && (pv.value || pv.numeric_value !== null)
  );

  if (displayableValues.length === 0) {
    return null;
  }

  const formatValue = (pv: PropertyValue): string => {
    if (pv.property?.property_type === "boolean") {
      return pv.value === "true" ? "Так" : "Ні";
    }
    if (pv.numeric_value !== null) {
      return String(pv.numeric_value);
    }
    return pv.value || "—";
  };

  const renderValue = (pv: PropertyValue) => {
    const formattedValue = formatValue(pv);
    
    // If property has page and option has slug, make it a link
    if (pv.property?.has_page && pv.option?.slug && pv.property?.slug) {
      return (
        <Link
          to={`/properties/${pv.property.slug}/${pv.option.slug}`}
          className="text-primary hover:underline"
        >
          {formattedValue}
        </Link>
      );
    }
    
    return formattedValue;
  };

  return (
    <dl className="divide-y">
      {displayableValues.map((pv) => (
        <div
          key={pv.property_id}
          className="flex justify-between py-3 first:pt-0 last:pb-0"
        >
          <dt className="text-muted-foreground">{pv.property?.name}</dt>
          <dd className="font-medium text-right">{renderValue(pv)}</dd>
        </div>
      ))}
    </dl>
  );
}
