import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StarRating } from "./StarRating";
import { ReviewRichTextEditor } from "./ReviewRichTextEditor";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { Loader2 } from "lucide-react";

interface ReviewFormProps {
  productId: string;
  onSubmit: (data: { rating: number; title?: string; content?: string; images?: string[] }) => void;
  isSubmitting?: boolean;
}

export function ReviewForm({ productId, onSubmit, isSubmitting }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [ratingError, setRatingError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setRatingError(true);
      return;
    }
    onSubmit({
      rating,
      title: title.trim() || undefined,
      content: content && content !== "<p></p>" ? content : undefined,
      images: images.length > 0 ? images : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-4">
      <h3 className="font-semibold text-lg">Написати відгук</h3>

      <div className="space-y-1">
        <Label>Оцінка *</Label>
        <StarRating
          value={rating}
          onChange={(v) => { setRating(v); setRatingError(false); }}
          size="lg"
        />
        {ratingError && <p className="text-sm text-destructive">Оберіть оцінку</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="review-title">Заголовок (необов'язково)</Label>
        <Input
          id="review-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Коротко про враження"
          maxLength={200}
        />
      </div>

      <div className="space-y-1">
        <Label>Текст відгуку</Label>
        <ReviewRichTextEditor content={content} onChange={setContent} />
      </div>

      <div className="space-y-1">
        <Label>Фото (до 5)</Label>
        <ImageUpload
          images={images}
          onImagesChange={setImages}
          bucket="review-images"
          folder={productId}
          maxImages={5}
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Надіслати відгук
      </Button>
    </form>
  );
}
