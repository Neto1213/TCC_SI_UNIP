import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/context/AuthProvider";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const navigate = useNavigate();
  const { texts, speakText } = useLanguage();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, senha);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      alert(err?.message || "Falha no login");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-learning-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-[var(--shadow-elegant)] border border-learning-primary/10">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-learning-primary to-learning-success mx-auto mb-4 p-4 shadow-[var(--shadow-card)]">
            <GraduationCap className="w-full h-full text-white" />
          </div>
          <h2 className="text-3xl font-bold text-foreground" onMouseEnter={() => speakText(texts.login)}>{texts.login}</h2>
          <p className="text-muted-foreground mt-2" onMouseEnter={() => speakText(texts.accessAccount)}>{texts.accessAccount}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" onMouseEnter={() => speakText(texts.email)}>{texts.email}</Label>
            <Input
              id="email"
              type="email"
              placeholder={texts.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha" onMouseEnter={() => speakText(texts.password)}>{texts.password}</Label>
            <Input
              id="senha"
              type="password"
              placeholder={texts.password}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-learning-primary to-learning-success hover:opacity-90 transition-opacity"
            onMouseEnter={() => speakText(texts.enter)}
          >
            {texts.enter}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <span onMouseEnter={() => speakText(texts.noAccount)}>{texts.noAccount}</span>{" "}
          <Link 
            to="/cadastro" 
            className="font-medium text-learning-primary hover:text-learning-primary/80 transition-colors"
            onMouseEnter={() => speakText(texts.register)}
          >
            {texts.register}
          </Link>
        </p>
      </div>
    </div>
  );
}
