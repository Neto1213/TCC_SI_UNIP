import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { resetPassword, validateResetToken } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";

// Tela de redefinição que valida o token e aplica a nova senha.
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const { token: tokenFromParams } = useParams<{ token: string }>();
  const token = searchParams.get("token") || tokenFromParams || "";
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { speakText } = useLanguage();

  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        setTokenValid(false);
        setValidating(false);
        return;
      }
      const result = await validateResetToken(token);
      setTokenValid(Boolean(result.valid));
      setValidating(false);
    };
    checkToken();
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!tokenValid) {
      setError("Link inválido ou expirado.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err: any) {
      setError(err?.message || "Não foi possível redefinir a senha.");
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-learning-primary/5 p-4">
        <div className="w-full max-w-md text-center text-muted-foreground" aria-live="polite">
          Validando link...
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-learning-primary/5 p-4">
        <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-[var(--shadow-elegant)] border border-learning-primary/10 text-center">
          <p className="text-lg font-semibold text-destructive mb-4" data-elevenlabs-readable>
            Link inválido ou expirado.
          </p>
          <Link
            to="/login"
            className="font-medium text-learning-primary hover:text-learning-primary/80 transition-colors"
            onMouseEnter={() => speakText("Voltar para o login")}
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-learning-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-[var(--shadow-elegant)] border border-learning-primary/10">
        <div className="text-center mb-6" data-elevenlabs-readable>
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-learning-primary to-learning-success mx-auto mb-4 p-4 shadow-[var(--shadow-card)]">
            <ShieldCheck className="w-full h-full text-white" />
          </div>
          <h2 className="text-3xl font-bold text-foreground" onMouseEnter={() => speakText("Definir nova senha")}>
            Definir nova senha
          </h2>
          <p className="text-muted-foreground mt-2" onMouseEnter={() => speakText("Crie uma senha segura para continuar")}>
            Crie uma senha segura para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nova-senha" onMouseEnter={() => speakText("Nova senha")}>
              Nova senha
            </Label>
            <Input
              id="nova-senha"
              type="password"
              placeholder="Nova senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Digite a nova senha"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmar-senha" onMouseEnter={() => speakText("Confirmar senha")}>
              Confirmar senha
            </Label>
            <Input
              id="confirmar-senha"
              type="password"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-label="Confirme a nova senha"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-learning-primary to-learning-success hover:opacity-90 transition-opacity"
            aria-label="Salvar nova senha"
            onMouseEnter={() => speakText("Salvar nova senha")}
          >
            Salvar nova senha
          </Button>
        </form>

        {success && (
          <div className="mt-4 text-sm text-learning-success" data-elevenlabs-readable aria-live="polite">
            Senha alterada com sucesso! Redirecionando para o login...
          </div>
        )}
        {error && (
          <div className="mt-2 text-sm text-destructive" data-elevenlabs-readable aria-live="assertive">
            {error}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            to="/login"
            className="font-medium text-learning-primary hover:text-learning-primary/80 transition-colors"
            onMouseEnter={() => speakText("Voltar para o login")}
          >
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  );
}
