import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";
import { requestPasswordReset } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";

// Tela de "Esqueci minha senha" que solicita o link de recuperação.
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { speakText } = useLanguage();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email);
    } catch (err: any) {
      setError(err?.message || "Não foi possível enviar o link agora, tente novamente.");
    } finally {
      // Independentemente da resposta, mostramos a mensagem genérica solicitada.
      setSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-learning-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-[var(--shadow-elegant)] border border-learning-primary/10">
        <div className="text-center mb-6" data-elevenlabs-readable>
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-learning-primary to-learning-success mx-auto mb-4 p-4 shadow-[var(--shadow-card)]">
            <Mail className="w-full h-full text-white" />
          </div>
          <h2 className="text-3xl font-bold text-foreground" onMouseEnter={() => speakText("Recuperar senha")}>
            Recuperar senha
          </h2>
          <p className="text-muted-foreground mt-2" onMouseEnter={() => speakText("Enviaremos um link de redefinição")}>
            Enviaremos um link para redefinir sua senha.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" onMouseEnter={() => speakText("E-mail")}>
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Digite seu e-mail para receber o link de recuperação"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-learning-primary to-learning-success hover:opacity-90 transition-opacity"
            aria-label="Enviar link de recuperação por e-mail"
            onMouseEnter={() => speakText("Enviar link de recuperação")}
          >
            {loading ? "Enviando..." : "Enviar link de recuperação"}
          </Button>
        </form>

        {submitted && (
          <div className="mt-4 text-sm text-learning-success" data-elevenlabs-readable aria-live="polite">
            Se este e-mail estiver cadastrado, enviaremos um link de recuperação.
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
