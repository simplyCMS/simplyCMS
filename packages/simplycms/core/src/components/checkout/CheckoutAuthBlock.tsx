
import React, { useState } from "react";
import { supabase } from "../../supabase/client";
import { useToast } from "../../hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, Loader2, LogIn, UserPlus, UserX, AlertCircle, CheckCircle } from "lucide-react";

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

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const clearMessages = () => {
    setAuthError(null);
    setAuthSuccess(null);
  };

  const handleLogin = async () => {
    if (!loginEmail || loginPassword.length < 6) return;
    setIsLoading(true);
    clearMessages();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        let errorMessage = error.message;
        if (error.message === "Invalid login credentials") {
          errorMessage = "Невiрний email або пароль.";
        }
        setAuthError(errorMessage);
        toast({ variant: "destructive", title: "Помилка входу", description: errorMessage });
      } else {
        setAuthSuccess("Успiшний вхiд!");
        toast({ title: "Успiшний вхiд!" });
        onAuthSuccess?.();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Щось пiшло не так.";
      setAuthError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (regFirstName.length < 2 || regLastName.length < 2 || !regEmail || regPassword.length < 6) return;
    setIsLoading(true);
    clearMessages();

    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            first_name: regFirstName,
            last_name: regLastName,
          },
        },
      });

      if (error) {
        let errorMessage = error.message;
        if (error.message.includes("already registered")) {
          errorMessage = "Цей email вже зареєстровано.";
        }
        setAuthError(errorMessage);
        toast({ variant: "destructive", title: "Помилка реєстрацiї", description: errorMessage });
      } else if (signUpData?.user && !signUpData.session) {
        setAuthSuccess("Реєстрацiя успiшна! Перевiрте вашу пошту.");
        toast({ title: "Перевiрте пошту!" });
      } else if (signUpData?.user && signUpData.session) {
        setAuthSuccess("Реєстрацiя успiшна!");
        toast({ title: "Реєстрацiя успiшна!" });
        onAuthSuccess?.();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Щось пiшло не так.";
      setAuthError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border rounded-lg">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <User className="h-5 w-5" />
          Данi покупця
        </h3>
        <p className="text-sm text-muted-foreground">
          Увiйдiть для швидкого оформлення або продовжуйте як гiсть
        </p>
      </div>
      <div className="p-4">
        {authError && (
          <div className="flex items-center gap-2 p-3 mb-4 border border-destructive/50 bg-destructive/10 rounded-md text-sm">
            <AlertCircle className="h-4 w-4 text-destructive" />
            {authError}
          </div>
        )}
        {authSuccess && (
          <div className="flex items-center gap-2 p-3 mb-4 border border-primary/50 bg-primary/10 rounded-md text-sm">
            <CheckCircle className="h-4 w-4 text-primary" />
            {authSuccess}
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-lg mb-4">
          {[
            { value: "guest", icon: UserX, label: "Гiсть" },
            { value: "login", icon: LogIn, label: "Увiйти" },
            { value: "register", icon: UserPlus, label: "Реєстрацiя" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setActiveTab(tab.value); clearMessages(); }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4 hidden sm:block" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Guest Tab */}
        {activeTab === "guest" && (
          <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
            <p>Оформiть замовлення без реєстрацiї. Вкажiть email або телефон для зв&apos;язку.</p>
          </div>
        )}

        {/* Login Tab */}
        {activeTab === "login" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-3 py-2 border rounded-md text-sm"
                  disabled={isLoading}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Пароль</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="........"
                  className="w-full pl-10 pr-10 py-2 border rounded-md text-sm"
                  disabled={isLoading}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium flex items-center justify-center"
              disabled={isLoading}
              onClick={handleLogin}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Увiйти
            </button>
          </div>
        )}

        {/* Register Tab */}
        {activeTab === "register" && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Iм&apos;я</label>
                <input
                  placeholder="Iван"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  disabled={isLoading}
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Прiзвище</label>
                <input
                  placeholder="Петренко"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  disabled={isLoading}
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-3 py-2 border rounded-md text-sm"
                  disabled={isLoading}
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Пароль</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="........"
                  className="w-full pl-10 pr-10 py-2 border rounded-md text-sm"
                  disabled={isLoading}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium flex items-center justify-center"
              disabled={isLoading}
              onClick={handleRegister}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Зареєструватися
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
