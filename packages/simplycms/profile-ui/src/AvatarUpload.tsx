import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabaseClient } from "@simplysoftua/core/supabase/SupabaseProvider";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@simplysoftua/ui/use-toast";

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  onUpdate?: (url: string | null) => void;
}

export function AvatarUpload({
  userId,
  currentAvatarUrl,
  firstName,
  lastName,
  email,
  onUpdate,
}: AvatarUploadProps) {
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const getInitials = () => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return (first + last).toUpperCase() || email?.[0]?.toUpperCase() || "?";
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
        throw new Error("Пiдтримуються тiльки JPG, PNG та WebP");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Максимальний розмiр файлу 5MB");
      }

      const ext = file.name.split(".").pop();
      const filename = `${userId}/avatar-${Date.now()}.${ext}`;

      if (currentAvatarUrl) {
        const oldPath = currentAvatarUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("user-avatars").remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from("user-avatars")
        .upload(filename, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("user-avatars").getPublicUrl(filename);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: (url) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      onUpdate?.(url);
      setPreviewUrl(null);
      toast({ title: "Аватар оновлено" });
    },
    onError: (error: Error) => {
      setPreviewUrl(null);
      toast({
        title: "Помилка завантаження",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!currentAvatarUrl) return;

      const path = currentAvatarUrl.split("/").slice(-2).join("/");
      await supabase.storage.from("user-avatars").remove([path]);

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      onUpdate?.(null);
      toast({ title: "Аватар видалено" });
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка видалення",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    uploadMutation.mutate(file);
  };

  const isLoading = uploadMutation.isPending || deleteMutation.isPending;
  const displayUrl = previewUrl || currentAvatarUrl;

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium">Фото профiлю</label>
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-muted flex items-center justify-center text-2xl font-medium">
            {displayUrl ? (
              <img src={displayUrl} alt="Avatar" width={96} height={96} className="rounded-full object-cover" loading="lazy" decoding="async" />
            ) : (
              getInitials()
            )}
          </div>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            className="px-3 py-1.5 border rounded-md text-sm flex items-center gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Camera className="h-4 w-4" />
            Завантажити фото
          </button>
          {currentAvatarUrl && (
            <button
              type="button"
              className="px-3 py-1.5 text-sm text-destructive hover:text-destructive flex items-center gap-2"
              onClick={() => deleteMutation.mutate()}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4" />
              Видалити
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            JPG, PNG або WebP. Макс. 5MB.
          </p>
        </div>
      </div>
    </div>
  );
}
