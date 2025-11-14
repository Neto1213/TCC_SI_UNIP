import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/context/AuthProvider";

export default function Cadastro() {
  const { texts, speakText } = useLanguage();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(email, senha);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      alert(err?.message || "Falha no cadastro");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-learning-success/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-[var(--shadow-elegant)] border border-learning-success/10">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-learning-success to-learning-creative mx-auto mb-4 p-4 shadow-[var(--shadow-card)]">
            <GraduationCap className="w-full h-full text-white" />
          </div>
          <h2 className="text-3xl font-bold text-foreground" onMouseEnter={() => speakText(texts.createAccount)}>{texts.createAccount}</h2>
          <p className="text-muted-foreground mt-2" onMouseEnter={() => speakText(texts.startYourStudyJourney)}>{texts.startYourStudyJourney}</p>
        </div>

        <form onSubmit={handleCadastro} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome" onMouseEnter={() => speakText(texts.fullName)}>{texts.fullName}</Label>
            <Input
              id="nome"
              type="text"
              placeholder={texts.enterYourName}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" onMouseEnter={() => speakText(texts.email)}>{texts.email}</Label>
            <Input
              id="email"
              type="email"
              placeholder={texts.enterYourEmail}
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
              placeholder={texts.createAPassword}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-learning-success to-learning-creative hover:opacity-90 transition-opacity"
            onMouseEnter={() => speakText(texts.createAccount)}
          >
            {texts.createAccount}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <span onMouseEnter={() => speakText(texts.alreadyHaveAccount)}>{texts.alreadyHaveAccount}</span>{" "}
          <Link 
            to="/login" 
            className="font-medium text-learning-success hover:text-learning-success/80 transition-colors"
            onMouseEnter={() => speakText(texts.login)}
          >
            {texts.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
