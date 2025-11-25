import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, BookOpenCheck, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { listPlans, type PlanSummary } from "@/lib/api";
import { useAuth } from "@/context/AuthProvider";
import { useLanguage } from "@/hooks/useLanguage";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { speakText } = useLanguage();
  const navigate = useNavigate();
  const [latestPlan, setLatestPlan] = useState<PlanSummary | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  // Carrega o plano mais recente sempre que o usuário abre o dashboard.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoadingPlan(true);
        const plans = await listPlans();
        if (!active) return;
        setLatestPlan(plans?.[0] ?? null);
        setPlansError(null);
      } catch (error: any) {
        if (!active) return;
        setPlansError(error?.message || "Não foi possível carregar seus planos.");
        setLatestPlan(null);
      } finally {
        if (active) {
          setLoadingPlan(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const greetingName = useMemo(() => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split("@")[0];
    return "aluno";
  }, [user]);

  const planDescription = useMemo(() => {
    if (!latestPlan) return "Você ainda não possui planos cadastrados.";
    const createdAt = latestPlan.created_at ? new Date(latestPlan.created_at) : null;
    const friendlyDate = createdAt ? createdAt.toLocaleDateString("pt-BR") : "—";
    return `Última atualização em ${friendlyDate}`;
  }, [latestPlan]);

  const goToPlannerNew = () => navigate("/plano-de-estudo/novo");
  const goToPlannerExisting = () => navigate("/plano-de-estudo");
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-learning-primary/10">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Bem-vindo(a) de volta</p>
            <h1 className="text-3xl font-bold text-foreground mt-1">Olá, {greetingName}!</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Continue a construir seus hábitos de estudo com planos personalizados. Aqui você encontra
              acesso rápido para criar novas jornadas, revisar o que já foi feito e ajustar sua conta.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="gap-2"
            onMouseEnter={() => speakText("Sair da conta")}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-[var(--shadow-card)] border-learning-primary/10 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-learning-primary" />
                Ações rápidas
              </CardTitle>
              <CardDescription>Escolha para onde ir em poucos cliques.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button
                className="justify-between"
                onClick={goToPlannerNew}
                onMouseEnter={() => speakText("Criar novo plano")}
              >
                <span>Criar novo plano</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                className="justify-between"
                onClick={goToPlannerExisting}
                onMouseEnter={() => speakText("Ir para meus planos")}
              >
                <span>Meus planos</span>
                <BookOpenCheck className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="justify-between"
                onClick={() => alert("Configurações em breve!")}
                onMouseEnter={() => speakText("Configurações")}
              >
                <span>Configurações</span>
                <Settings className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)] border-learning-success/10 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenCheck className="h-5 w-5 text-learning-success" />
                Seu último plano
              </CardTitle>
              <CardDescription>{planDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPlan ? (
                <div className="space-y-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : plansError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {plansError}
                </div>
              ) : latestPlan ? (
                <div className="space-y-2">
                  <p className="text-lg font-semibold">{latestPlan.plan_title || latestPlan.tema}</p>
                  <p className="text-sm text-muted-foreground">Objetivo: {latestPlan.learning_type || "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    Semanas planejadas: {latestPlan.semanas ?? "—"}
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-4"
                    onClick={() => navigate("/plano-de-estudo")}
                    onMouseEnter={() => speakText("Abrir plano completo")}
                  >
                    Abrir plano completo
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Parece que você ainda não criou um plano. Toque em "Criar novo plano" para começar agora mesmo.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
