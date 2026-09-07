import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
      // Validate file
      if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
        throw new Error("Підтримуються тільки JPG, PNG та WebP");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Максимальний розмір файлу 5MB");
      }

      // Generate unique filename
      const ext = file.name.split(".").pop();
      const filename = `${userId}/avatar-${Date.now()}.${ext}`;

      // Delete old avatar if exists
      if (currentAvatarUrl) {
        const oldPath = currentAvatarUrl.split("/").slice(-2).join("/");
        await supabase.storage.from("user-avatars").remove([oldPath]);
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from("user-avatars")
        .upload(filename, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("user-avatars").getPublicUrl(filename);

      // Update profile
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

      // Delete from storage
      const path = currentAvatarUrl.split("/").slice(-2).join("/");
      await supabase.storage.from("user-avatars").remove([path]);

      // Update profile
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

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    uploadMutation.mutate(file);
  };

  const isLoading = uploadMutation.isPending || deleteMutation.isPending;
  const displayUrl = previewUrl || currentAvatarUrl;

  return (
    <div className="space-y-4">
      <Label>Фото профілю</Label>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-24 w-24">
            <AvatarImage src={displayUrl || undefined} />
            <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
          </Avatar>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Camera className="h-4 w-4 mr-2" />
            Завантажити фото
          </Button>
          {currentAvatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={isLoading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Видалити
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            JPG, PNG або WebP. Макс. 5MB.
          </p>
        </div>
      </div>
    </div>
  );
}
