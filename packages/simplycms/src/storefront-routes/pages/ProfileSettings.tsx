import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Save, Loader2, KeyRound } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from 'simplycms/ui/card';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import { Skeleton } from 'simplycms/ui/skeleton';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'simplycms/ui/form';
import { useAuth } from '@simplycms/core/hooks/useAuth';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT, type Translator } from 'simplycms/i18n';
import { toast } from '@simplycms/core/hooks/use-toast';
import { AvatarUpload } from '@simplycms/core/components/profile/AvatarUpload';
import { AddressesList } from '@simplycms/core/components/profile/AddressesList';
import { RecipientsList } from '@simplycms/core/components/profile/RecipientsList';

// Фабрики схем: повідомлення валідації живуть у каталозі, а транслятор
// доступний лише в рендері. Обидві мемоїзуються по `t` у компоненті.
const buildProfileSchema = (t: Translator) =>
  z.object({
    firstName: z
      .string()
      .min(2, t('validation.min2'))
      .max(100, t('validation.max100')),
    lastName: z
      .string()
      .min(2, t('validation.min2'))
      .max(100, t('validation.max100')),
    phone: z
      .string()
      .min(10, t('validation.phone'))
      .max(20, t('validation.max20'))
      .optional()
      .or(z.literal('')),
  });

const buildPasswordSchema = (t: Translator) =>
  z
    .object({
      newPassword: z.string().min(6, t('validation.min6')),
      confirmPassword: z.string().min(6, t('validation.min6')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmPassword'],
    });

type ProfileFormData = z.infer<ReturnType<typeof buildProfileSchema>>;
type PasswordFormData = z.infer<ReturnType<typeof buildPasswordSchema>>;

export default function ProfileSettingsPage() {
  const t = useT();
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<{
    first_name?: string | null;
    last_name?: string | null;
  } | null>(null);

  const profileSchema = useMemo(() => buildProfileSchema(t), [t]);
  const passwordSchema = useMemo(() => buildPasswordSchema(t), [t]);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;

      try {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          profileForm.setValue('firstName', data.first_name || '');
          profileForm.setValue('lastName', data.last_name || '');
          profileForm.setValue('phone', data.phone || '');
          setAvatarUrl(data.avatar_url);
          setProfileData({
            first_name: data.first_name,
            last_name: data.last_name,
          });
        }
      } catch (error: unknown) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [user, profileForm, supabase]);

  const onProfileSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone || null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: t('profile.settings.saved'),
        description: t('profile.settings.savedHint'),
      });
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      toast({
        title: t('common.error'),
        description:
          error instanceof Error
            ? error.message
            : t('profile.settings.saveFailed'),
        variant: 'destructive',
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
        title: t('profile.password.changed'),
        description: t('profile.password.changedHint'),
      });
    } catch (error: unknown) {
      console.error('Error changing password:', error);
      toast({
        title: t('common.error'),
        description:
          error instanceof Error ? error.message : t('profile.password.failed'),
        variant: 'destructive',
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
      <h1 className="text-2xl font-bold">{t('nav.settings')}</h1>

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('profile.settings.avatar')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarUpload
            userId={user?.id || ''}
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
            {t('profile.personalData')}
          </CardTitle>
          <CardDescription>
            {t('profile.settings.editContacts')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form
              onSubmit={profileForm.handleSubmit(onProfileSubmit)}
              className="space-y-4"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.firstName')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t(
                            'profile.settings.firstNamePlaceholder',
                          )}
                          {...field}
                        />
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
                      <FormLabel>{t('common.lastName')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t(
                            'profile.settings.lastNamePlaceholder',
                          )}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <FormLabel>Email</FormLabel>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="mt-2 bg-muted"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {t('profile.settings.emailLocked')}
                </p>
              </div>

              <FormField
                control={profileForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.phone')}</FormLabel>
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
                    {t('common.saving')}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('common.save')}
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
            {t('profile.password.title')}
          </CardTitle>
          <CardDescription>{t('profile.password.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
              className="space-y-4"
            >
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('profile.password.new')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t('validation.min6')}
                        {...field}
                      />
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
                    <FormLabel>{t('profile.password.confirm')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t('profile.password.confirmPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                variant="secondary"
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('profile.password.pending')}
                  </>
                ) : (
                  t('profile.password.submit')
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
