import { useState } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { StarRating } from "./StarRating";
import { useAuth } from "@simplysoftua/core/hooks/useAuth";
import type { ProductReview } from "@simplysoftua/core/hooks/useProductReviews";

interface ReviewCardProps {
  review: ProductReview;
  onDelete?: (id: string) => void;
}

export function ReviewCard({ review, onDelete }: ReviewCardProps) {
  const { user } = useAuth();
  const isOwn = user?.id === review.user_id;
  const isPending = review.status === "pending";
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
              {review.profile?.avatar_url ? (
                <img src={review.profile.avatar_url} alt={displayName} width={40} height={40} className="rounded-full object-cover" loading="lazy" decoding="async" />
              ) : (
                initials
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{displayName}</span>
                {isOwn && isPending && (
                  <span className="text-xs px-2 py-0.5 rounded border">На модерацii</span>
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
            <div className="relative">
              <button
                className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              {confirmDelete && (
                <div className="absolute right-0 top-full mt-1 bg-background border rounded-lg shadow-lg p-4 z-10 w-64">
                  <p className="text-sm font-medium mb-2">Видалити вiдгук?</p>
                  <p className="text-xs text-muted-foreground mb-3">Цю дiю неможливо скасувати.</p>
                  <div className="flex gap-2 justify-end">
                    <button className="px-3 py-1 border rounded text-sm" onClick={() => setConfirmDelete(false)}>Скасувати</button>
                    <button className="px-3 py-1 bg-destructive text-destructive-foreground rounded text-sm" onClick={() => { onDelete(review.id); setConfirmDelete(false); }}>Видалити</button>
                  </div>
                </div>
              )}
            </div>
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
              <button
                key={i}
                className="relative h-20 w-20 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border"
                onClick={() => setLightboxImage(url)}
              >
                <img
                  src={url}
                  alt={`Фото ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </button>
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
          <div className="relative w-full h-full">
            <img
              src={lightboxImage}
              alt="Збiльшене фото"
              className="absolute inset-0 w-full h-full object-contain rounded-lg"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      )}
    </>
  );
}
