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
import { Eye, EyeOff, Mail, Lock, User, Loader2, Zap } from 'lucide-react';
import { z } from 'zod';
import { useT, type Translator } from 'simplycms/i18n';

// Фабрики схем: повідомлення беруть з каталогу, тому потребують транслятора.
const buildLoginSchema = (t: Translator) =>
  z.object({
    email: z.string().email(t('validation.email')),
    password: z.string().min(6, t('validation.passwordMin6')),
  });

const buildRegisterSchema = (t: Translator) =>
  z
    .object({
      firstName: z.string().min(2, t('validation.firstNameMin2')),
      lastName: z.string().min(2, t('validation.lastNameMin2')),
      email: z.string().email(t('validation.email')),
      password: z.string().min(6, t('validation.passwordMin6')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordMismatch'),
      path: ['confirmPassword'],
    });

export default function Auth() {
  const t = useT();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>(search.tab || 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loginSchema = useMemo(() => buildLoginSchema(t), [t]);
  const registerSchema = useMemo(() => buildRegisterSchema(t), [t]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
            error.code === 'INVALID_EMAIL_OR_PASSWORD'
              ? t('auth.login.badCredentials')
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

  /**
   * Запит на скидання пароля.
   *
   * 🔴 Відповідь навмисно однакова для існуючої й неіснуючої пошти — так її
   * будує сам Better Auth, і UI не має права цю рівність порушити: інакше
   * форма перетворюється на перелічувач зареєстрованих адрес.
   */
  const handleForgotPassword = async () => {
    if (!loginEmail) {
      toast({ variant: 'destructive', title: t('auth.forgot.needEmail') });
      return;
    }

    setIsLoading(true);
    await authClient.requestPasswordReset({
      email: loginEmail,
      redirectTo: '/auth/set-password',
    });
    setIsLoading(false);
    toast({ title: t('auth.forgot.sent') });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const result = registerSchema.safeParse({
        firstName,
        lastName,
        email: registerEmail,
        password: registerPassword,
        confirmPassword,
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

      // Better Auth тримає одне поле `name`; на пару воно розбирається
      // серверним хуком провізії (`splitName` у `simplycms/auth`).
      const { error } = await authClient.signUp.email({
        email: registerEmail,
        password: registerPassword,
        name: `${firstName} ${lastName}`,
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: t('auth.register.failed'),
          description: error.message ?? t('auth.genericError'),
        });
      } else {
        toast({
          title: t('auth.register.success'),
          description: t('auth.register.created'),
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
              {t('auth.brand')}
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
                    onClick={handleForgotPassword}
                    disabled={isLoading}
                  >
                    {t('auth.forgot.link')}
                  </Button>
                </form>
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">{t('common.firstName')}</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="firstName"
                          type="text"
                          placeholder={t('auth.firstNamePlaceholder')}
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className={`pl-10 ${errors.firstName ? 'border-destructive' : ''}`}
                          disabled={isLoading}
                        />
                      </div>
                      {errors.firstName && (
                        <p className="text-sm text-destructive">
                          {errors.firstName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName">{t('common.lastName')}</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder={t('auth.lastNamePlaceholder')}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={errors.lastName ? 'border-destructive' : ''}
                        disabled={isLoading}
                      />
                      {errors.lastName && (
                        <p className="text-sm text-destructive">
                          {errors.lastName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="your@email.com"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        className={`pl-10 ${errors.email ? 'border-destructive' : ''}`}
                        disabled={isLoading}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">
                      {t('auth.password')}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="--------"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
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

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      {t('auth.passwordConfirm')}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="--------"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`pl-10 pr-10 ${errors.confirmPassword ? 'border-destructive' : ''}`}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('auth.register.pending')}
                      </>
                    ) : (
                      t('auth.register.submit')
                    )}
                  </Button>
                </form>
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
