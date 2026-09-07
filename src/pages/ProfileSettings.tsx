import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Save, Loader2, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { AddressesList } from "@/components/profile/AddressesList";
import { RecipientsList } from "@/components/profile/RecipientsList";

const profileSchema = z.object({
  firstName: z.string().min(2, "Мінімум 2 символи").max(100, "Максимум 100 символів"),
  lastName: z.string().min(2, "Мінімум 2 символи").max(100, "Максимум 100 символів"),
  phone: z.string().min(10, "Введіть коректний номер телефону").max(20, "Максимум 20 символів").optional().or(z.literal("")),
});

const passwordSchema = z.object({
  newPassword: z.string().min(6, "Мінімум 6 символів"),
  confirmPassword: z.string().min(6, "Мінімум 6 символів"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Паролі не співпадають",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfileSettings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<{ first_name?: string; last_name?: string } | null>(null);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;

      try {
      const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name, phone, avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data) {
          profileForm.setValue("firstName", data.first_name || "");
          profileForm.setValue("lastName", data.last_name || "");
          profileForm.setValue("phone", data.phone || "");
          setAvatarUrl(data.avatar_url);
          setProfileData({ first_name: data.first_name, last_name: data.last_name });
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [user, profileForm]);

  const onProfileSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Збережено",
        description: "Ваші дані успішно оновлено",
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось зберегти дані",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) throw error;

      passwordForm.reset();
      toast({
        title: "Пароль змінено",
        description: "Ваш пароль успішно оновлено",
      });
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось змінити пароль",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Налаштування</h1>

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Фото профілю</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarUpload
            userId={user?.id || ""}
            currentAvatarUrl={avatarUrl}
            firstName={profileData?.first_name}
            lastName={profileData?.last_name}
            email={user?.email}
            onUpdate={setAvatarUrl}
          />
        </CardContent>
      </Card>

      {/* Profile settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Особисті дані
          </CardTitle>
          <CardDescription>
            Редагуйте свої контактні дані
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ім'я</FormLabel>
                      <FormControl>
                        <Input placeholder="Введіть ім'я" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Прізвище</FormLabel>
                      <FormControl>
                        <Input placeholder="Введіть прізвище" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <FormLabel>Email</FormLabel>
                <Input value={user?.email || ""} disabled className="mt-2 bg-muted" />
                <p className="text-sm text-muted-foreground mt-1">
                  Email неможливо змінити
                </p>
              </div>

              <FormField
                control={profileForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Телефон</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+380" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Збереження...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Зберегти
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Зміна пароля
          </CardTitle>
          <CardDescription>
            Встановіть новий пароль для вашого акаунта
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Новий пароль</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Мінімум 6 символів" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Підтвердіть пароль</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Повторіть новий пароль" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" variant="secondary" disabled={isChangingPassword}>
                {isChangingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Зміна...
                  </>
                ) : (
                  "Змінити пароль"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Addresses */}
      <AddressesList />

      {/* Recipients */}
      <RecipientsList />
    </div>
  );
}
