import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StarRating } from "./StarRating";
import { useAuth } from "@/hooks/useAuth";
import type { ProductReview } from "@/hooks/useProductReviews";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ReviewCardProps {
  review: ProductReview;
  onDelete?: (id: string) => void;
}

export function ReviewCard({ review, onDelete }: ReviewCardProps) {
  const { user } = useAuth();
  const isOwn = user?.id === review.user_id;
  const isPending = review.status === "pending";
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const displayName = review.profile
    ? [review.profile.first_name, review.profile.last_name].filter(Boolean).join(" ") || "Користувач"
    : "Користувач";

  const initials = review.profile
    ? [review.profile.first_name?.[0], review.profile.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "U"
    : "U";

  return (
    <>
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={review.profile?.avatar_url || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{displayName}</span>
                {isOwn && isPending && (
                  <Badge variant="outline" className="text-xs">На модерації</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StarRating value={review.rating} readonly size="sm" />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(review.created_at), "d MMM yyyy", { locale: uk })}
                </span>
              </div>
            </div>
          </div>

          {isOwn && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Видалити відгук?</AlertDialogTitle>
                  <AlertDialogDescription>Цю дію неможливо скасувати.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Скасувати</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(review.id)}>Видалити</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {review.title && (
          <h4 className="font-semibold">{review.title}</h4>
        )}

        {review.content && review.content !== "<p></p>" && (
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: review.content }}
          />
        )}

        {review.images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {review.images.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Фото ${i + 1}`}
                className="h-20 w-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border"
                onClick={() => setLightboxImage(url)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="Збільшене фото"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </>
  );
}
