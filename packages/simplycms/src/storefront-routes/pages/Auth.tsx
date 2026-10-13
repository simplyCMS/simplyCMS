import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { authClient } from 'simplycms/core/lib/auth-client';
import { useAuth } from 'simplycms/core/hooks/useAuth';
import { Button } from 'simplycms/ui/button';
import { Input } from 'simplycms/ui/input';
import { Label } from 'simplycms/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'simplycms/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'simplycms/ui/tabs';
import { useToast } from 'simplycms/core/hooks/use-toast';
import { Eye, EyeOff, Mail, Lock, Loader2, Zap } from 'lucide-react';
import { z } from 'zod';
import { useT, type Translator } from 'simplycms/i18n';
import { useStoreProfile } from 'simplycms/themes/store-profile';
import { useForgotPassword } from 'simplycms/core/hooks/useForgotPassword';
import { RegisterForm } from './RegisterForm';
import { bannedMessage } from 'simplycms/core/lib/banned-message';

// Фабрики схем: повідомлення беруть з каталогу, тому потребують транслятора.
const buildLoginSchema = (t: Translator) =>
  z.object({
    email: z.string().email(t('validation.email')),
    password: z.string().min(6, t('validation.passwordMin6')),
  });

export default function Auth() {
  const t = useT();
  // Назва магазину — з профілю, а не з каталогу ядра: ключ `auth.brand`
  // показував би всім магазинам один рядок (Е6б-20).
  const { name: storeName, contacts } = useStoreProfile();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { requestReset, pending: forgotPending } = useForgotPassword();

  const [activeTab, setActiveTab] = useState<string>(search.tab || 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loginSchema = useMemo(() => buildLoginSchema(t), [t]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  useEffect(() => {
    if (user && !authLoading) {
      navigate({ to: '/' });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const result = loginSchema.safeParse({
        email: loginEmail,
        password: loginPassword,
      });

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
        setIsLoading(false);
        return;
      }

      const { error } = await authClient.signIn.email({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        // 🔴 Розрізняємо за КОДОМ, а не за текстом: текст Better Auth
        // локалізується й змінюється версією, код — частина контракту.
        toast({
          variant: 'destructive',
          title: t('auth.login.failed'),
          description:
            error.code === 'BANNED'
              ? bannedMessage(t, contacts)
              : error.code === 'INVALID_EMAIL_OR_PASSWORD'
                ? t('auth.login.badCredentials')
                : error.code === 'EMAIL_NOT_VERIFIED'
                  ? t('auth.login.emailNotVerified')
                  : (error.message ?? t('auth.genericError')),
        });
      } else {
        toast({
          title: t('auth.login.success'),
          description: t('auth.login.welcome'),
        });
        navigate({ to: '/' });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('auth.genericError'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="p-2 bg-primary rounded-lg">
              <Zap className="h-8 w-8 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">
              {storeName}
            </span>
          </div>
          <p className="text-muted-foreground">{t('auth.tagline')}</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">
              {t(
                activeTab === 'login'
                  ? 'auth.login.title'
                  : 'auth.register.title',
              )}
            </CardTitle>
            <CardDescription className="text-center">
              {t(
                activeTab === 'login'
                  ? 'auth.login.subtitle'
                  : 'auth.register.subtitle',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">{t('auth.login.tab')}</TabsTrigger>
                <TabsTrigger value="register">
                  {t('auth.register.title')}
                </TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className={`pl-10 ${errors.email ? 'border-destructive' : ''}`}
                        disabled={isLoading}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t('auth.password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="--------"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className={`pl-10 pr-10 ${errors.password ? 'border-destructive' : ''}`}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('auth.login.pending')}
                      </>
                    ) : (
                      t('auth.login.submit')
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-muted-foreground"
                    onClick={() => void requestReset(loginEmail)}
                    disabled={isLoading || forgotPending}
                  >
                    {t('auth.forgot.link')}
                  </Button>
                </form>
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register" className="space-y-4">
                <RegisterForm
                  onGoToLogin={(email) => {
                    // Адреса з реєстрації переходить у вхід: не вводити вдруге.
                    setLoginEmail(email);
                    setActiveTab('login');
                  }}
                />
              </TabsContent>
            </Tabs>

            {/* Back to Home */}
            <div className="mt-6 text-center">
              <Button
                variant="link"
                onClick={() => navigate({ to: '/' })}
                className="text-muted-foreground"
              >
                {t('auth.backHome')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
