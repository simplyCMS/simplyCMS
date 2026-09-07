import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, Loader2, LogIn, UserPlus, UserX, AlertCircle, CheckCircle } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Введіть коректний email"),
  password: z.string().min(6, "Пароль має містити мінімум 6 символів"),
});

const registerSchema = z.object({
  firstName: z.string().min(2, "Ім'я має містити мінімум 2 символи"),
  lastName: z.string().min(2, "Прізвище має містити мінімум 2 символи"),
  email: z.string().email("Введіть коректний email"),
  password: z.string().min(6, "Пароль має містити мінімум 6 символів"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

interface CheckoutAuthBlockProps {
  onAuthSuccess?: () => void;
  defaultTab?: "guest" | "login" | "register";
}

export function CheckoutAuthBlock({ onAuthSuccess, defaultTab = "guest" }: CheckoutAuthBlockProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  const clearMessages = () => {
    setAuthError(null);
    setAuthSuccess(null);
  };

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    clearMessages();
    
    console.log("[CheckoutAuthBlock] Starting login for:", data.email);
    
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      console.log("[CheckoutAuthBlock] Login response:", { signInData, error });

      if (error) {
        let errorMessage = error.message;
        if (error.message === "Invalid login credentials") {
          errorMessage = "Невірний email або пароль. Перевірте введені дані.";
        } else if (error.message === "Email not confirmed") {
          errorMessage = "Email не підтверджено. Перевірте вашу пошту.";
        } else if (error.message.includes("rate limit")) {
          errorMessage = "Забагато спроб. Зачекайте кілька хвилин.";
        }
        
        console.log("[CheckoutAuthBlock] Login error:", errorMessage);
        setAuthError(errorMessage);
        toast({
          variant: "destructive",
          title: "Помилка входу",
          description: errorMessage,
        });
      } else {
        console.log("[CheckoutAuthBlock] Login successful");
        setAuthSuccess("Успішний вхід! Завантажуємо ваші дані...");
        toast({ title: "Успішний вхід!" });
        onAuthSuccess?.();
      }
    } catch (error: any) {
      console.error("[CheckoutAuthBlock] Login exception:", error);
      const errorMessage = error?.message || "Щось пішло не так. Спробуйте ще раз.";
      setAuthError(errorMessage);
      toast({
        variant: "destructive",
        title: "Помилка",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    setIsLoading(true);
    clearMessages();
    
    console.log("[CheckoutAuthBlock] Starting registration for:", data.email);
    
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
          },
        },
      });

      console.log("[CheckoutAuthBlock] SignUp response:", { signUpData, error });

      if (error) {
        let errorMessage = error.message;
        if (error.message.includes("already registered")) {
          errorMessage = "Цей email вже зареєстровано. Спробуйте увійти.";
        } else if (error.message.includes("password")) {
          errorMessage = "Пароль занадто слабкий. Використовуйте більше символів.";
        } else if (error.message.includes("valid email")) {
          errorMessage = "Введіть коректну email адресу.";
        }
        
        console.log("[CheckoutAuthBlock] Registration error:", errorMessage);
        setAuthError(errorMessage);
        toast({
          variant: "destructive",
          title: "Помилка реєстрації",
          description: errorMessage,
        });
      } else if (signUpData?.user && !signUpData.session) {
        // Email confirmation required
        console.log("[CheckoutAuthBlock] Email confirmation required");
        setAuthSuccess("Реєстрація успішна! Перевірте вашу пошту для підтвердження email.");
        toast({ 
          title: "Перевірте пошту!",
          description: "Ми надіслали лист для підтвердження email.",
        });
      } else if (signUpData?.user && signUpData.session) {
        // Auto-confirmed, user is now logged in
        console.log("[CheckoutAuthBlock] Registration successful, auto-confirmed");
        setAuthSuccess("Реєстрація успішна! Ваші дані завантажуються...");
        toast({ 
          title: "Реєстрація успішна!",
          description: "Вітаємо! Ви можете продовжити оформлення.",
        });
        onAuthSuccess?.();
      } else {
        // Fallback
        console.log("[CheckoutAuthBlock] Registration completed (fallback)");
        setAuthSuccess("Реєстрація успішна!");
        toast({ title: "Реєстрація успішна!" });
        onAuthSuccess?.();
      }
    } catch (error: any) {
      console.error("[CheckoutAuthBlock] Registration exception:", error);
      const errorMessage = error?.message || "Щось пішло не так. Спробуйте ще раз.";
      setAuthError(errorMessage);
      toast({
        variant: "destructive",
        title: "Помилка",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    clearMessages();
    
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });

      if (result.redirected) {
        // Page is redirecting to OAuth provider
        return;
      }

      if (result.error) {
        const errorMessage = result.error.message || "Помилка авторизації через Google";
        setAuthError(errorMessage);
        toast({
          variant: "destructive",
          title: "Помилка Google авторизації",
          description: errorMessage,
        });
      } else {
        setAuthSuccess("Успішний вхід через Google!");
        toast({ title: "Успішний вхід!" });
        onAuthSuccess?.();
      }
    } catch (error) {
      const errorMessage = "Щось пішло не так. Спробуйте ще раз.";
      setAuthError(errorMessage);
      toast({
        variant: "destructive",
        title: "Помилка",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5" />
          Дані покупця
        </CardTitle>
        <CardDescription>
          Увійдіть для швидкого оформлення або продовжуйте як гість
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Error Alert */}
        {authError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        )}
        
        {/* Success Alert */}
        {authSuccess && (
          <Alert className="mb-4 border-primary/50 bg-primary/10">
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-foreground">{authSuccess}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); clearMessages(); }} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="guest" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <UserX className="h-4 w-4 hidden sm:block" />
              Гість
            </TabsTrigger>
            <TabsTrigger value="login" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <LogIn className="h-4 w-4 hidden sm:block" />
              Увійти
            </TabsTrigger>
            <TabsTrigger value="register" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <UserPlus className="h-4 w-4 hidden sm:block" />
              Реєстрація
            </TabsTrigger>
          </TabsList>

          {/* Guest Tab */}
          <TabsContent value="guest" className="space-y-3">
            <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
              <p>Оформіть замовлення без реєстрації. Вкажіть email або телефон для зв'язку.</p>
            </div>
          </TabsContent>

          {/* Login Tab */}
          <TabsContent value="login" className="space-y-4">
            <Form {...loginForm}>
              <div className="space-y-3">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            className="pl-10"
                            disabled={isLoading}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Пароль</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pl-10 pr-10"
                            disabled={isLoading}
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="button" 
                  className="w-full" 
                  disabled={isLoading}
                  onClick={loginForm.handleSubmit(handleLogin)}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Увійти
                </Button>
              </div>
            </Form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">або</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Увійти через Google
            </Button>
          </TabsContent>

          {/* Register Tab */}
          <TabsContent value="register" className="space-y-4">
            <Form {...registerForm}>
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <FormField
                    control={registerForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ім'я</FormLabel>
                        <FormControl>
                          <Input placeholder="Іван" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Прізвище</FormLabel>
                        <FormControl>
                          <Input placeholder="Петренко" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            className="pl-10"
                            disabled={isLoading}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Пароль</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pl-10 pr-10"
                            disabled={isLoading}
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="button" 
                  className="w-full" 
                  disabled={isLoading}
                  onClick={registerForm.handleSubmit(handleRegister)}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Зареєструватися
                </Button>
              </div>
            </Form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">або</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Реєстрація через Google
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
