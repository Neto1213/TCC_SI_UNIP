import { useState, useEffect, useCallback } from "react";
import BehavioralProfile, { BehavioralProfile as BehavioralProfileType } from "@/components/BehavioralProfile";
import StudyPlanForm, { StudyPlan } from "@/components/StudyPlanForm";
import StudyPlanGenerator, { Task as KanbanTask } from "@/components/StudyPlanGenerator";
import LoadingMonkey from "@/components/LoadingMonkey";
import { StudyPlanSidebar } from "@/components/StudyPlanSidebar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GraduationCap, Sparkles, ArrowRight, Menu } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";
import {
  predictPlan,
  listPlans,
  getPlan,
  PlanSummary,
  PlanDetail,
  StudyCard,
} from "@/lib/api";
import { useAuth } from "@/context/AuthProvider";

type AppStep = 'welcome' | 'profile' | 'plan' | 'loading' | 'result';

type ServerPlan = PlanSummary;

const Index = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>('welcome');
  const [behavioralProfile, setBehavioralProfile] = useState<BehavioralProfileType | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [currentPlanData, setCurrentPlanData] = useState<PlanDetail | null>(null);
  const [serverPlans, setServerPlans] = useState<ServerPlan[]>([]);
  const [selectedServerPlanId, setSelectedServerPlanId] = useState<number | null>(null);
  const [loadingServerPlans, setLoadingServerPlans] = useState(false);
  const [isCreatingNewPlan, setIsCreatingNewPlan] = useState(false);
  const navigate = useNavigate();
  const { texts, speakText } = useLanguage();
  const { user, logout, isAuthenticated } = useAuth();

  const handleProfileComplete = (profile: BehavioralProfileType) => {
    setBehavioralProfile(profile);
    setCurrentStep('plan');
  };

  const [initialTasks, setInitialTasks] = useState<KanbanTask[] | undefined>();
  const [backendError, setBackendError] = useState<string | undefined>();

  const mapEstiloSymbol = useCallback((symbol: string): BehavioralProfileType["estilo_aprendizado"] => {
    const normalized = (symbol || "").toUpperCase();
    const map: Record<string, BehavioralProfileType["estilo_aprendizado"]> = {
      T: "teorico",
      P: "pratico",
      B: "balanceado",
      I: "intensivo",
    };
    return map[normalized] || "balanceado";
  }, []);

  const buildBehavioralFromPlan = useCallback(
    (plan: PlanDetail): BehavioralProfileType => ({
      estilo_aprendizado: mapEstiloSymbol(plan.perfil_label || ""),
      tolerancia_dificuldade: "media",
      nivel_foco: "medio",
      resiliencia_estudo: "media",
    }),
    [mapEstiloSymbol]
  );

  const learningTypeToObjective = useCallback((type?: string): StudyPlan["objetivo_estudo"] => {
    switch (type) {
      case "prova":
        return "prova";
      case "habito":
        return "habito";
      case "profundo":
        return "aprendizado_profundo";
      case "apresentacao":
        return "projeto";
      default:
        return "habito";
    }
  }, []);

  const normalizeLearningType = (objective?: string) => {
    switch (objective) {
      case "aprendizado_profundo":
        return "profundo";
      case "projeto":
        return "apresentacao";
      default:
        return objective || "default";
    }
  };

  const buildStudyPlanFromMeta = useCallback(
    (plan: PlanDetail | null): StudyPlan => ({
      tema_estudo: plan?.tema || "Plano",
      conhecimento_tema: "intermediario",
      tempo_semanal: Number(plan?.raw_response?.carga_horas_semana) || 4,
      objetivo_estudo: learningTypeToObjective(plan?.learning_type),
    }),
    [learningTypeToObjective]
  );

  const formatEffort = useCallback((minutes?: number) => {
    if (!minutes) return "60 min";
    if (minutes < 60) return `${minutes} min`;
    const hours = minutes / 60;
    return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
  }, []);

  const tasksFromCards = useCallback(
    (cards: StudyCard[]): KanbanTask[] => {
      return cards.map((card) => ({
        id: card.id,
        title: card.title,
        type: card.type as any,
        description: card.description || "",
        instructions: card.instructions || "",
        hoursLabel: formatEffort(card.effort_minutes),
        effortMinutes: card.effort_minutes,
        stageSuggestion: card.stage_suggestion,
        needsReview: card.needs_review,
        reviewAfterDays: card.review_after_days,
        columnKey: card.column_key || "novo",
        week: card.week,
        notes: card.notes,
        order: card.order,
      }));
    },
    [formatEffort]
  );

  const loadPlanFromServer = useCallback(
    async (planId: number) => {
      setBackendError(undefined);
      try {
        const detail = await getPlan(planId);
        setCurrentPlanData(detail);
        setStudyPlan(buildStudyPlanFromMeta(detail));
        setBehavioralProfile(buildBehavioralFromPlan(detail));
        setInitialTasks(tasksFromCards(detail.cards || []));
        setSelectedServerPlanId(detail.id);
        setIsCreatingNewPlan(false);
        setCurrentStep("result");
      } catch (err: any) {
        setBackendError(err?.message || "Falha ao carregar plano salvo");
      }
    },
    [buildBehavioralFromPlan, buildStudyPlanFromMeta, tasksFromCards]
  );

  const fetchServerPlans = useCallback(
    async (options?: { selectPlanId?: number; fallbackToLatest?: boolean; autoLoad?: boolean }) => {
      if (!isAuthenticated) {
        setServerPlans([]);
        setSelectedServerPlanId(null);
        return;
      }

      const { selectPlanId, fallbackToLatest = false, autoLoad = false } = options || {};
      setLoadingServerPlans(true);
      try {
        const plans = await listPlans();
        const normalized: ServerPlan[] = Array.isArray(plans) ? plans : [];
        setServerPlans(normalized);
        if (normalized.length === 0) {
          setSelectedServerPlanId(null);
        }

        const shouldAutoLoad = autoLoad && normalized.length > 0 && !isCreatingNewPlan;

        if (shouldAutoLoad) {
          let targetId = selectPlanId;
          if (!targetId && fallbackToLatest) {
            targetId = normalized[0].id;
          }
          if (targetId) {
            await loadPlanFromServer(targetId);
          }
        }
      } catch (err: any) {
        setBackendError(err?.message || "Falha ao carregar planos do servidor");
      } finally {
        setLoadingServerPlans(false);
      }
    },
    [loadPlanFromServer, isCreatingNewPlan, isAuthenticated]
  );

  const handlePlanComplete = async (plan: StudyPlan) => {
    setStudyPlan(plan);
    setCurrentStep('loading');
    setBackendError(undefined);
    setInitialTasks(undefined);
    setIsCreatingNewPlan(true);

    try {
      if (!behavioralProfile) throw new Error('Perfil comportamental não definido');

      const resp = await predictPlan({
        perfil: {
          estilo_aprendizado: behavioralProfile.estilo_aprendizado,
          tolerancia_dificuldade: behavioralProfile.tolerancia_dificuldade,
          nivel_foco: behavioralProfile.nivel_foco as any,
          resiliencia_estudo: behavioralProfile.resiliencia_estudo,
        },
        plano: plan,
        semanas: 4,
        use_gpt: true,
        model: 'gpt-4o-mini',
        max_tokens: 1200,
      });

      if (!resp.plan || !resp.cards) {
        throw new Error('Plano não pôde ser gerado corretamente.');
      }

      const generatedPlanId = resp.plan_id ? Number(resp.plan_id) : undefined;
      setCurrentPlanData({ ...resp.plan, cards: resp.cards, raw_response: undefined });
      setInitialTasks(tasksFromCards(resp.cards));
      setIsCreatingNewPlan(false);

      if (!generatedPlanId) {
        throw new Error('Plano não pôde ser salvo no servidor. Verifique se está autenticado.');
      }

      setSelectedServerPlanId(generatedPlanId);
      setIsCreatingNewPlan(false);
      await fetchServerPlans({ selectPlanId: generatedPlanId, autoLoad: true });
    } catch (err: any) {
      setBackendError(err?.message || 'Falha ao gerar plano');
      setInitialTasks(undefined);
    }

    setCurrentStep('result');
  };

  const handleStartOver = () => {
    setBehavioralProfile(null);
    setStudyPlan(null);
    setSelectedServerPlanId(null);
    setCurrentPlanData(null);
    setInitialTasks(undefined);
    setIsCreatingNewPlan(true);
    setCurrentStep('welcome');
  };

  const handleSelectServerPlan = useCallback(
    async (planId: number) => {
      setIsCreatingNewPlan(false);
      await loadPlanFromServer(planId);
    },
    [loadPlanFromServer]
  );

  const handleNotesSaved = useCallback(async () => {
    if (!selectedServerPlanId) return;
    try {
      await loadPlanFromServer(selectedServerPlanId);
      await fetchServerPlans();
    } catch (err) {
      console.error("Falha ao atualizar plano após salvar notas", err);
    }
  }, [selectedServerPlanId, loadPlanFromServer, fetchServerPlans]);

  useEffect(() => {
    fetchServerPlans({ fallbackToLatest: true, autoLoad: true });
  }, [fetchServerPlans]);
  if (currentStep === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-learning-primary/5 flex items-center justify-center p-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-learning-primary to-learning-creative p-6 shadow-[var(--shadow-elegant)]">
                <GraduationCap className="w-full h-full text-white" />
              </div>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-learning-primary via-learning-success to-learning-creative bg-clip-text text-transparent" onMouseEnter={() => speakText(texts.personalizedStudyPlan)}>
              {texts.personalizedStudyPlan}
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed" onMouseEnter={() => speakText(texts.createUniquePlan)}>
              {texts.createUniquePlan}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="p-6 rounded-xl bg-gradient-to-br from-card to-learning-primary/5 border border-learning-primary/10 shadow-[var(--shadow-card)]">
              <div className="w-12 h-12 rounded-lg bg-learning-primary/10 flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">🧠</span>
              </div>
              <h3 className="font-semibold mb-2" onMouseEnter={() => speakText(texts.behavioralAnalysis)}>{texts.behavioralAnalysis}</h3>
              <p className="text-sm text-muted-foreground" onMouseEnter={() => speakText(texts.identifyLearningStyle)}>
                {texts.identifyLearningStyle}
              </p>
            </div>
            
            <div className="p-6 rounded-xl bg-gradient-to-br from-card to-learning-success/5 border border-learning-success/10 shadow-[var(--shadow-card)]">
              <div className="w-12 h-12 rounded-lg bg-learning-success/10 flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="font-semibold mb-2" onMouseEnter={() => speakText(texts.clearGoals)}>{texts.clearGoals}</h3>
              <p className="text-sm text-muted-foreground" onMouseEnter={() => speakText(texts.defineTopicLevel)}>
                {texts.defineTopicLevel}
              </p>
            </div>
            
            <div className="p-6 rounded-xl bg-gradient-to-br from-card to-learning-creative/5 border border-learning-creative/10 shadow-[var(--shadow-card)]">
              <div className="w-12 h-12 rounded-lg bg-learning-creative/10 flex items-center justify-center mb-4 mx-auto">
                <span className="text-2xl">✨</span>
              </div>
              <h3 className="font-semibold mb-2" onMouseEnter={() => speakText(texts.intelligentPlan)}>{texts.intelligentPlan}</h3>
              <p className="text-sm text-muted-foreground" onMouseEnter={() => speakText(texts.receiveScheduleResources)}>
                {texts.receiveScheduleResources}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => setCurrentStep('profile')}
              className="bg-gradient-to-r from-learning-primary to-learning-creative hover:opacity-90 transition-opacity text-lg px-8 py-6"
              size="lg"
              onMouseEnter={() => speakText(texts.startAnalysis)}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              {texts.startAnalysis}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <div className="text-sm text-muted-foreground" onMouseEnter={() => speakText(texts.takesOnlyMinutes)}>
              {texts.takesOnlyMinutes}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'profile') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-learning-primary/5 py-12 px-4">
        <BehavioralProfile onComplete={handleProfileComplete} />
      </div>
    );
  }

  if (currentStep === 'plan') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-learning-success/5 py-12 px-4">
        <StudyPlanForm onComplete={handlePlanComplete} />
      </div>
    );
  }

  if (currentStep === 'loading') {
    return <LoadingMonkey message="Gerando seu plano de estudos personalizado..." />;
  }

  if (currentStep === 'result' && behavioralProfile && studyPlan) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <StudyPlanSidebar
            plans={serverPlans}
            selectedPlanId={selectedServerPlanId}
            onSelectPlan={handleSelectServerPlan}
            onCreateNew={handleStartOver}
            loadingPlans={loadingServerPlans}
          />
          <div className="flex-1 flex flex-col">
            <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex items-center px-4">
              <SidebarTrigger className="mr-2">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <h2 className="text-lg font-semibold">Plano de Estudos</h2>
              <div className="ml-auto flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 border rounded-full px-3 py-1 text-sm hover:bg-muted">
                      <Avatar className="h-6 w-6"><AvatarFallback>{(user?.email?.[0] || "U").toUpperCase()}</AvatarFallback></Avatar>
                      <span className="hidden sm:inline">{user?.email || "Usuário"}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>
                      <div className="text-sm font-medium">{user?.email || "Usuário"}</div>
                      <div className="text-xs text-muted-foreground">Perfil atual: {currentPlanData?.perfil_label || currentPlanData?.estilo || "—"}</div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/plano-de-estudo")}>Formulário</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/kanban")}>Kanban</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        logout();
                        navigate("/login", { replace: true });
                      }}
                      className="text-destructive"
                    >
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <div className="bg-gradient-to-br from-background via-background to-learning-creative/5 py-12 px-4">
                {backendError && (
                  <div className="max-w-4xl mx-auto mb-6 p-3 rounded-md border border-destructive/30 text-destructive bg-destructive/5">
                    Falha ao gerar plano pela API: {backendError}
                  </div>
                )}
                <StudyPlanGenerator
                  behavioralProfile={behavioralProfile}
                  studyPlan={studyPlan}
                  learningType={currentPlanData?.learning_type || normalizeLearningType(studyPlan.objetivo_estudo)}
                  serverPlanId={selectedServerPlanId ? String(selectedServerPlanId) : undefined}
                  onStartOver={handleStartOver}
                  initialTasks={initialTasks}
                  onNotesSaved={handleNotesSaved}
                />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return null;
};

export default Index;
