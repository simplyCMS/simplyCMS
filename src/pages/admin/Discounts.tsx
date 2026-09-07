import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ChevronRight, ChevronDown, Percent, DollarSign, Tag, Trash2, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const operatorLabels: Record<string, string> = {
  and: "ТА (сума)",
  or: "АБО (перша)",
  not: "НЕ (інверсія)",
  min: "МІН (найменша)",
  max: "МАКС (найбільша)",
};

const operatorColors: Record<string, string> = {
  and: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  or: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  not: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  min: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  max: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const discountTypeLabels: Record<string, string> = {
  percent: "%",
  fixed_amount: "грн",
  fixed_price: "= грн",
};

interface DiscountGroup {
  id: string;
  name: string;
  description: string | null;
  operator: string;
  parent_group_id: string | null;
  is_active: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  discounts?: any[];
  children?: DiscountGroup[];
}

export default function Discounts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["discount-groups-tree"],
    queryFn: async () => {
      const { data: allGroups, error: gErr } = await supabase
        .from("discount_groups")
        .select("*")
        .order("priority");
      if (gErr) throw gErr;

      const { data: allDiscounts, error: dErr } = await supabase
        .from("discounts")
        .select("*, price_types(name)")
        .order("priority");
      if (dErr) throw dErr;

      // Build tree
      const map = new Map<string, DiscountGroup>();
      for (const g of allGroups as any[]) {
        map.set(g.id, {
          ...g,
          discounts: [],
          children: [],
        });
      }
      for (const d of allDiscounts || []) {
        map.get(d.group_id)?.discounts?.push(d);
      }
      const roots: DiscountGroup[] = [];
      for (const g of map.values()) {
        if (g.parent_group_id && map.has(g.parent_group_id)) {
          map.get(g.parent_group_id)!.children!.push(g);
        } else {
          roots.push(g);
        }
      }
      return roots;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("discount_groups").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["discount-groups-tree"] }),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discount_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-groups-tree"] });
      toast({ title: "Групу видалено" });
    },
  });

  const deleteDiscount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-groups-tree"] });
      toast({ title: "Скидку видалено" });
    },
  });

  const toggleExpanded = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  function renderGroup(group: DiscountGroup, depth: number = 0) {
    const isExpanded = expandedGroups.has(group.id);
    const hasChildren = (group.children?.length || 0) > 0 || (group.discounts?.length || 0) > 0;

    return (
      <div key={group.id} style={{ marginLeft: depth * 24 }} className="border-l-2 border-muted pl-4 mb-2">
        <div className="flex items-center gap-2 py-2 group">
          <button onClick={() => toggleExpanded(group.id)} className="p-0.5">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          <Badge variant="outline" className={operatorColors[group.operator]}>
            {operatorLabels[group.operator]}
          </Badge>

          <span className={`font-medium ${!group.is_active ? "text-muted-foreground line-through" : ""}`}>
            {group.name}
          </span>

          {group.starts_at || group.ends_at ? (
            <Badge variant="outline" className="text-xs">
              {group.starts_at ? new Date(group.starts_at).toLocaleDateString() : "∞"}
              {" — "}
              {group.ends_at ? new Date(group.ends_at).toLocaleDateString() : "∞"}
            </Badge>
          ) : null}

          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Switch
              checked={group.is_active}
              onCheckedChange={(checked) => toggleActive.mutate({ id: group.id, is_active: checked })}
            />
            <Button variant="ghost" size="icon" asChild>
              <Link to={`/admin/discounts/groups/${group.id}`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Видалити групу?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Всі скидки та дочірні групи будуть видалені разом з цією групою.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Скасувати</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteGroup.mutate(group.id)}>Видалити</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {isExpanded && (
          <div className="ml-2">
            {/* Discounts in this group */}
            {group.discounts?.map((d) => (
              <div key={d.id} className="flex items-center gap-2 py-1.5 pl-6 group/discount">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className={`text-sm ${!d.is_active ? "text-muted-foreground line-through" : ""}`}>
                  {d.name}
                </span>
                <Badge variant="outline" className="text-xs">
                  {d.discount_type === 'percent' ? '-' : d.discount_type === 'fixed_price' ? '=' : '-'}
                  {d.discount_value}
                  {discountTypeLabels[d.discount_type]}
                </Badge>
                 {d.price_types && (
                   <Badge variant="secondary" className="text-xs">
                     {d.price_types.name}
                   </Badge>
                 )}
                <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/discount:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <Link to={`/admin/discounts/${d.id}`}>
                      <Pencil className="h-3 w-3" />
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Видалити скидку?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Скидку «{d.name}» буде видалено назавжди.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Скасувати</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteDiscount.mutate(d.id)}>Видалити</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}

            {/* Child groups */}
            {group.children?.map((child) => renderGroup(child, depth + 1))}

            {/* Add buttons */}
            <div className="flex gap-2 py-1 pl-6">
              <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                <Link to={`/admin/discounts/new?groupId=${group.id}`}>
                  <Plus className="h-3 w-3 mr-1" /> Скидка
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                <Link to={`/admin/discounts/groups/new?parentId=${group.id}`}>
                  <Plus className="h-3 w-3 mr-1" /> Підгрупа
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Скидки</h1>
          <p className="text-muted-foreground mt-1">
            Управління групами скидок та умовами їх застосування
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/price-validator">
              <DollarSign className="h-4 w-4 mr-2" /> Валідатор цін
            </Link>
          </Button>
          <Button asChild>
            <Link to="/admin/discounts/groups/new">
              <Plus className="h-4 w-4 mr-2" /> Нова група
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Дерево скидок</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Завантаження...</p>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Percent className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Ще немає груп скидок</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link to="/admin/discounts/groups/new">Створити першу групу</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {groups.map((g) => renderGroup(g))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
