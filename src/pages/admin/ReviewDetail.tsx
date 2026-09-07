import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StarRating } from "@/components/reviews/StarRating";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Check, X, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useState } from "react";

export default function AdminReviewDetail() {
  const { reviewId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminComment, setAdminComment] = useState("");

  const { data: review, isLoading } = useQuery({
    queryKey: ["admin-review", reviewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("*")
        .eq("id", reviewId)
        .single();
      if (error) throw error;

      // Fetch product
      const { data: product } = await supabase
        .from("products")
        .select("id, name, slug, sections(slug)")
        .eq("id", data.product_id)
        .single();

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, avatar_url")
        .eq("user_id", data.user_id)
        .single();

      return {
        ...data,
        images: Array.isArray(data.images) ? data.images : [],
        product,
        profile,
      };
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ status, comment }: { status: string; comment?: string }) => {
      const updateData: any = { status };
      if (comment !== undefined) updateData.admin_comment = comment;
      const { error } = await supabase
        .from("product_reviews")
        .update(updateData)
        .eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-review", reviewId] });
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast({ title: "Статус оновлено" });
    },
  });

  const deleteReview = useMutation({
    mutationFn: async () => {
      // Delete images from storage
      if (review?.images?.length) {
        const paths = review.images.map((url: string) => {
          try {
            const u = new URL(url);
            const match = u.pathname.match(/\/review-images\/(.+)$/);
            return match ? match[1] : null;
          } catch { return null; }
        }).filter(Boolean) as string[];
        if (paths.length > 0) {
          await supabase.storage.from("review-images").remove(paths);
        }
      }
      const { error } = await supabase.from("product_reviews").delete().eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast({ title: "Відгук видалено" });
      navigate("/admin/reviews");
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!review) {
    return <p>Відгук не знайдено</p>;
  }

  const authorName = review.profile
    ? [review.profile.first_name, review.profile.last_name].filter(Boolean).join(" ") || review.profile.email || "—"
    : "—";

  const initials = review.profile
    ? [review.profile.first_name?.[0], review.profile.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "U"
    : "U";

  const statusLabels: Record<string, string> = { pending: "На модерації", approved: "Затверджено", rejected: "Відхилено" };
  const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = { pending: "outline", approved: "default", rejected: "destructive" };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/reviews")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Деталі відгуку</h1>
        <Badge variant={statusVariants[review.status] || "outline"}>
          {statusLabels[review.status] || review.status}
        </Badge>
      </div>

      {/* Product & Author info */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Товар</CardTitle></CardHeader>
          <CardContent>
            {review.product ? (
              <Link
                to={`/catalog/${review.product.sections?.slug || "all"}/${review.product.slug}`}
                className="font-medium text-primary hover:underline"
              >
                {review.product.name}
              </Link>
            ) : <span>—</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Автор</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={review.profile?.avatar_url || undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{authorName}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(review.created_at), "d MMM yyyy HH:mm", { locale: uk })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review content */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <StarRating value={review.rating} readonly size="lg" />
            <span className="text-lg font-semibold">{review.rating}/5</span>
          </div>

          {review.title && <h3 className="text-lg font-semibold">{review.title}</h3>}

          {review.content && review.content !== "<p></p>" && (
            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: review.content }} />
          )}

          {review.images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {review.images.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`Фото ${i + 1}`} className="h-24 w-24 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin actions */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Коментар адміна</Label>
            <Textarea
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              placeholder="Причина відхилення або коментар..."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {review.status !== "approved" && (
              <Button
                onClick={() => updateStatus.mutate({ status: "approved", comment: adminComment || undefined })}
                disabled={updateStatus.isPending}
              >
                <Check className="h-4 w-4 mr-1" /> Затвердити
              </Button>
            )}
            {review.status !== "rejected" && (
              <Button
                variant="outline"
                onClick={() => updateStatus.mutate({ status: "rejected", comment: adminComment || undefined })}
                disabled={updateStatus.isPending}
              >
                <X className="h-4 w-4 mr-1" /> Відхилити
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Видалити
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Видалити відгук?</AlertDialogTitle>
                  <AlertDialogDescription>Відгук та всі його зображення будуть видалені назавжди.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Скасувати</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteReview.mutate()}>Видалити</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {review.admin_comment && (
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Попередній коментар:</p>
              <p className="text-sm">{review.admin_comment}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
