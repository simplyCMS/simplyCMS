import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { StarRating } from './StarRating';

interface ReviewFormProps {
  productId: string;
  onSubmit: (data: {
    rating: number;
    title?: string;
    content?: string;
    images?: string[];
  }) => void;
  isSubmitting?: boolean;
  /** Optional rich text editor component */
  renderEditor?: (props: {
    content: string;
    onChange: (content: string) => void;
  }) => React.ReactNode;
  /** Optional image upload component */
  renderImageUpload?: (props: {
    images: string[];
    onImagesChange: (images: string[]) => void;
    bucket: string;
    folder: string;
    maxImages: number;
  }) => React.ReactNode;
}

export function ReviewForm({
  productId,
  onSubmit,
  isSubmitting,
  renderEditor,
  renderImageUpload,
}: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
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
      content: content && content !== '<p></p>' ? content : undefined,
      images: images.length > 0 ? images : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-4">
      <h3 className="font-semibold text-lg">Написати вiдгук</h3>

      <div className="space-y-1">
        <label className="text-sm font-medium">Оцiнка *</label>
        <StarRating
          value={rating}
          onChange={(v) => {
            setRating(v);
            setRatingError(false);
          }}
          size="lg"
        />
        {ratingError && (
          <p className="text-sm text-destructive">Оберiть оцiнку</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="review-title" className="text-sm font-medium">
          Заголовок (необов&apos;язково)
        </label>
        <input
          id="review-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Коротко про враження"
          maxLength={200}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Текст вiдгуку</label>
        {renderEditor ? (
          renderEditor({ content, onChange: setContent })
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Напишiть ваш вiдгук..."
            className="w-full px-3 py-2 border rounded-md text-sm resize-none min-h-[120px]"
          />
        )}
      </div>

      {renderImageUpload && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Фото (до 5)</label>
          {renderImageUpload({
            images,
            onImagesChange: setImages,
            bucket: 'review-images',
            folder: productId,
            maxImages: 5,
          })}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium flex items-center"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Надiслати вiдгук
      </button>
    </form>
  );
}
