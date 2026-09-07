import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";

type SectionProperty = Tables<"section_properties">;

interface PropertyOption {
  id: string;
  property_id: string;
  name: string;
  slug: string;
  sort_order: number;
}

interface Props {
  productId: string;
  sectionId: string;
}

export function AllProductProperties({ productId, sectionId }: Props) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, { 
    value: string | null; 
    numeric_value: number | null;
    option_id: string | null;
  }>>({});

  // Fetch ALL properties assigned to this section (both product and modification level)
  const { data: properties, isLoading: loadingProperties } = useQuery({
    queryKey: ["section-all-properties", sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_property_assignments")
        .select(`
          id,
          sort_order,
          applies_to,
          property:property_id (
            id,
            name,
            slug,
            property_type,
            is_required,
            is_filterable,
            has_page
          )
        `)
        .eq("section_id", sectionId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data.map(a => ({
        ...a.property,
        applies_to: a.applies_to
      })).filter(Boolean) as (SectionProperty & { applies_to: string })[];
    },
    enabled: !!sectionId,
  });

  // Fetch property options for select/multiselect properties
  const { data: propertyOptions } = useQuery({
    queryKey: ["property-options-all", properties?.map(p => p.id)],
    queryFn: async () => {
      if (!properties?.length) return {};
      
      const selectProperties = properties.filter(
        p => p.property_type === "select" || p.property_type === "multiselect"
      );
      
      if (selectProperties.length === 0) return {};
      
      const propertyIds = selectProperties.map(p => p.id);
      const { data, error } = await supabase
        .from("property_options")
        .select("*")
        .in("property_id", propertyIds)
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      
      const grouped: Record<string, PropertyOption[]> = {};
      data?.forEach(opt => {
        if (!grouped[opt.property_id]) {
          grouped[opt.property_id] = [];
        }
        grouped[opt.property_id].push(opt);
      });
      
      return grouped;
    },
    enabled: !!properties?.length,
  });

  // Fetch existing product property values
  const { data: existingValues, isLoading: loadingValues } = useQuery({
    queryKey: ["product-all-property-values", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_property_values")
        .select("*")
        .eq("product_id", productId);
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  useEffect(() => {
    if (existingValues) {
      const valuesMap: Record<string, { 
        value: string | null; 
        numeric_value: number | null;
        option_id: string | null;
      }> = {};
      existingValues.forEach((v: any) => {
        valuesMap[v.property_id] = { 
          value: v.value, 
          numeric_value: v.numeric_value,
          option_id: v.option_id || null
        };
      });
      setValues(valuesMap);
    }
  }, [existingValues]);

  const saveMutation = useMutation({
    mutationFn: async ({ 
      propertyId, 
      value, 
      numericValue,
      optionId 
    }: { 
      propertyId: string; 
      value: string | null; 
      numericValue: number | null;
      optionId?: string | null;
    }) => {
      const existingValue = existingValues?.find((v: any) => v.property_id === propertyId);
      
      if (existingValue) {
        const { error } = await supabase
          .from("product_property_values")
          .update({ 
            value, 
            numeric_value: numericValue,
            option_id: optionId ?? null
          })
          .eq("id", existingValue.id);
        if (error) throw error;
      } else if (value || numericValue !== null || optionId) {
        const { error } = await supabase
          .from("product_property_values")
          .insert([{ 
            product_id: productId, 
            property_id: propertyId, 
            value, 
            numeric_value: numericValue,
            option_id: optionId ?? null
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-all-property-values", productId] });
    },
  });

  const handleChange = (
    propertyId: string, 
    value: string | null, 
    numericValue: number | null = null,
    optionId: string | null = null
  ) => {
    setValues(prev => ({
      ...prev,
      [propertyId]: { value, numeric_value: numericValue, option_id: optionId }
    }));
    saveMutation.mutate({ propertyId, value, numericValue, optionId });
  };

  const handleSelectChange = (propertyId: string, optionId: string) => {
    const options = propertyOptions?.[propertyId] || [];
    const option = options.find(o => o.id === optionId);
    handleChange(propertyId, option?.name || null, null, optionId);
  };

  const handleMultiselectChange = (propertyId: string, optionId: string, checked: boolean) => {
    const current = values[propertyId];
    const currentOptionIds = current?.option_id?.split(",").filter(Boolean) || [];
    
    let newOptionIds: string[];
    if (checked) {
      newOptionIds = [...currentOptionIds, optionId];
    } else {
      newOptionIds = currentOptionIds.filter(id => id !== optionId);
    }
    
    const options = propertyOptions?.[propertyId] || [];
    const selectedOptions = options.filter(o => newOptionIds.includes(o.id));
    const newValue = selectedOptions.map(o => o.name).join(", ");
    
    handleChange(propertyId, newValue || null, null, newOptionIds.join(",") || null);
  };

  if (loadingProperties || loadingValues) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Властивості товару</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!properties || properties.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Властивості товару</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
            Для цього розділу ще не налаштовані властивості
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderPropertyInput = (property: SectionProperty & { applies_to: string }) => {
    const currentValue = values[property.id];
    const options = propertyOptions?.[property.id] || [];

    switch (property.property_type) {
      case "text":
        return (
          <Input
            value={currentValue?.value || ""}
            onChange={(e) => handleChange(property.id, e.target.value || null)}
            placeholder={`Введіть ${property.name.toLowerCase()}`}
          />
        );

      case "number":
      case "range":
        return (
          <Input
            type="number"
            value={currentValue?.numeric_value ?? ""}
            onChange={(e) => {
              const num = e.target.value ? parseFloat(e.target.value) : null;
              handleChange(property.id, num?.toString() || null, num);
            }}
            placeholder="0"
          />
        );

      case "select":
        return (
          <Select
            value={currentValue?.option_id || ""}
            onValueChange={(val) => handleSelectChange(property.id, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Оберіть значення" />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multiselect":
        const selectedOptionIds = currentValue?.option_id?.split(",").filter(Boolean) || [];
        return (
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt.id} className="flex items-center gap-2">
                <Checkbox
                  id={`all-${property.id}-${opt.id}`}
                  checked={selectedOptionIds.includes(opt.id)}
                  onCheckedChange={(checked) => 
                    handleMultiselectChange(property.id, opt.id, !!checked)
                  }
                />
                <Label htmlFor={`all-${property.id}-${opt.id}`} className="font-normal">
                  {opt.name}
                </Label>
              </div>
            ))}
            {options.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Опцій не знайдено. Додайте опції у властивості.
              </p>
            )}
          </div>
        );

      case "boolean":
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={currentValue?.value === "true"}
              onCheckedChange={(checked) => handleChange(property.id, checked ? "true" : "false")}
            />
            <span className="text-sm text-muted-foreground">
              {currentValue?.value === "true" ? "Так" : "Ні"}
            </span>
          </div>
        );

      case "color":
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={currentValue?.value || "#000000"}
              onChange={(e) => handleChange(property.id, e.target.value)}
              className="h-10 w-20 rounded border cursor-pointer"
            />
            <Input
              value={currentValue?.value || ""}
              onChange={(e) => handleChange(property.id, e.target.value || null)}
              placeholder="#000000"
              className="w-32"
            />
          </div>
        );

      default:
        return (
          <Input
            value={currentValue?.value || ""}
            onChange={(e) => handleChange(property.id, e.target.value || null)}
          />
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Властивості товару</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {properties.map((property) => (
            <div key={property.id} className="space-y-2">
              <Label className="flex items-center gap-2">
                {property.name}
                {property.is_required && <span className="text-destructive">*</span>}
                <span className="text-xs text-muted-foreground">
                  ({property.applies_to === "product" ? "товар" : "модифікація"})
                </span>
              </Label>
              {renderPropertyInput(property)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
