import { useState, useEffect, useCallback } from "react";
import BehavioralProfile, { BehavioralProfile as BehavioralProfileType } from "@/components/BehavioralProfile";
import StudyPlanForm, { StudyPlan } from "@/components/StudyPlanForm";
import { Task as KanbanTask } from "@/components/StudyPlanGenerator";
import LoadingMonkey from "@/components/LoadingMonkey";
import StudyPlanWelcome from "@/components/StudyPlanWelcome";
import StudyPlanWorkspace from "@/components/StudyPlanWorkspace";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { useNavigate, useLocation } from "react-router-dom";
import {
  predictPlan,
  listPlans,
  getPlan,
  PlanSummary,
  PlanDetail,
  StudyCard,
  deletePlan as deletePlanApi,
  deactivatePlan,
} from "@/lib/api";
import { useAuth } from "@/context/AuthProvider";

type AppStep = 'welcome' | 'profile' | 'plan' | 'loading' | 'result' | 'empty';

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
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);
  const [hiddenPlanIds, setHiddenPlanIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem("hidden_plan_ids");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [planHoursMap, setPlanHoursMap] = useState<Record<number, number>>(() => {
    try {
      const stored = localStorage.getItem("plan_hours_map");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const savePlanHours = useCallback((planId: number, hours: number) => {
    const value = Number(hours);
    if (!Number.isFinite(value) || value <= 0) return;
    setPlanHoursMap((prev) => {
      const next = { ...prev, [planId]: value };
      localStorage.setItem("plan_hours_map", JSON.stringify(next));
      return next;
    });
  }, []);

  const removePlanHours = useCallback((planId: number) => {
    setPlanHoursMap((prev) => {
      const next = { ...prev };
      delete next[planId];
      localStorage.setItem("plan_hours_map", JSON.stringify(next));
      return next;
    });
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = (location.state as { mode?: "new" | "existing" } | null) || null;
  const pathMode = location.pathname.includes("/plano-de-estudo/novo") ? "new" : "existing";
  const navigationMode = navigationState?.mode || pathMode;
  const shouldAutoLoadPlans = navigationMode !== "new";
  const { texts, speakText } = useLanguage();
  const { isAuthenticated } = useAuth();

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
    (plan: PlanDetail | null): StudyPlan => {
      const weeklyHoursCandidates = [
        (plan as any)?.tempo_semanal,
        (plan as any)?.carga_horas_semana,
        plan?.raw_response?.carga_horas_semana,
        plan?.raw_response?.tempo_semanal,
        plan?.raw_response?.weekly_hours,
      ];
      const weeklyHours = weeklyHoursCandidates
        .map((value) => {
          const num = Number(value);
          return Number.isFinite(num) && num > 0 ? num : null;
        })
        .find((v) => v !== null) ?? 0;

      return {
        tema_estudo: plan?.tema || "Plano",
        conhecimento_tema: "intermediario",
        tempo_semanal: weeklyHours,
        objetivo_estudo: learningTypeToObjective(plan?.learning_type),
      };
    },
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
        const metaPlan = buildStudyPlanFromMeta(detail);
        const overrideHours = planHoursMap[planId];
        const tempoFinal = overrideHours ?? metaPlan.tempo_semanal;
        const studyPlanResult = { ...metaPlan, tempo_semanal: tempoFinal };

        setCurrentPlanData({ ...detail, tempo_semanal: tempoFinal });
        setStudyPlan(studyPlanResult);
        setBehavioralProfile(buildBehavioralFromPlan(detail));
        setInitialTasks(tasksFromCards(detail.cards || []));
        setSelectedServerPlanId(detail.id);
        setIsCreatingNewPlan(false);
        setCurrentStep("result");
      } catch (err: any) {
        setBackendError(err?.message || "Falha ao carregar plano salvo");
        setCurrentPlanData(null);
        setStudyPlan(null);
        setInitialTasks(undefined);
        setSelectedServerPlanId(null);
        setCurrentStep("empty");
      }
    },
    [buildBehavioralFromPlan, buildStudyPlanFromMeta, tasksFromCards, planHoursMap]
  );

  const fetchServerPlans = useCallback(
    async (options?: { selectPlanId?: number; fallbackToLatest?: boolean; autoLoad?: boolean }) => {
      if (!isAuthenticated) {
        setServerPlans([]);
        setSelectedServerPlanId(null);
        if (navigationMode === "existing") {
          setCurrentStep("welcome");
        }
        return;
      }

      const { selectPlanId, fallbackToLatest = false, autoLoad = false } = options || {};
      setLoadingServerPlans(true);
      try {
        const plans = await listPlans();
        const normalized: ServerPlan[] = Array.isArray(plans) ? plans : [];
        const filtered = normalized.filter((p) => !hiddenPlanIds.includes(p.id));
        setServerPlans(filtered);
        if (filtered.length === 0) {
          setSelectedServerPlanId(null);
          if (navigationMode === "existing") {
            setCurrentStep("empty");
          }
        }

        const shouldAutoLoad = autoLoad && normalized.length > 0 && !isCreatingNewPlan;

        if (shouldAutoLoad) {
          let targetId = selectPlanId;
          if (!targetId && fallbackToLatest) {
            targetId = filtered[0].id;
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
    [loadPlanFromServer, isCreatingNewPlan, isAuthenticated, navigationMode, hiddenPlanIds]
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
      savePlanHours(generatedPlanId, plan.tempo_semanal);
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
    if (location.pathname !== "/plano-de-estudo/novo") {
      navigate("/plano-de-estudo/novo", { replace: true });
    }
  };

  const handleSelectServerPlan = useCallback(
    async (planId: number) => {
      setIsCreatingNewPlan(false);
      await loadPlanFromServer(planId);
    },
    [loadPlanFromServer]
  );

  const handleDeletePlan = useCallback(
    async (planId: number) => {
      const confirmed = window.confirm("Apagar este plano? Ele não aparecerá mais na lista.");
      if (!confirmed) return;
      setLoadingServerPlans(true);
      setDeletingPlanId(planId);
      try {
        let removedFromServer = false;
        try {
          await deletePlanApi(planId);
          removedFromServer = true;
        } catch (err: any) {
          // tenta desativar se delete não existir
          try {
            await deactivatePlan(planId);
            removedFromServer = true;
          } catch (innerErr) {
            console.warn("Falha ao desativar plano, ocultando localmente", innerErr);
          }
        }

        if (!removedFromServer) {
          // fallback: marcar como oculto localmente
          const updatedHidden = Array.from(new Set([...hiddenPlanIds, planId]));
          setHiddenPlanIds(updatedHidden);
          localStorage.setItem("hidden_plan_ids", JSON.stringify(updatedHidden));
        }

        if (selectedServerPlanId === planId) {
          setSelectedServerPlanId(null);
          setCurrentPlanData(null);
          setInitialTasks(undefined);
          setCurrentStep("welcome");
        }
        removePlanHours(planId);
        await fetchServerPlans({ fallbackToLatest: true, autoLoad: navigationMode !== "new" });
      } catch (err: any) {
        // se tudo falhar, ainda assim oculte localmente
        const updatedHidden = Array.from(new Set([...hiddenPlanIds, planId]));
        setHiddenPlanIds(updatedHidden);
        localStorage.setItem("hidden_plan_ids", JSON.stringify(updatedHidden));
        await fetchServerPlans({ fallbackToLatest: true, autoLoad: navigationMode !== "new" });
        alert(err?.message || "Falha ao apagar/desativar plano no servidor. O plano foi ocultado localmente.");
      } finally {
        setLoadingServerPlans(false);
        setDeletingPlanId(null);
      }
    },
    [selectedServerPlanId, fetchServerPlans, navigationMode, hiddenPlanIds, removePlanHours]
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
    fetchServerPlans({ fallbackToLatest: shouldAutoLoadPlans, autoLoad: shouldAutoLoadPlans });
  }, [fetchServerPlans, shouldAutoLoadPlans, hiddenPlanIds, planHoursMap]);

  useEffect(() => {
    if (navigationMode === "existing" && currentStep === "welcome") {
      setCurrentStep("loading");
    }
  }, [navigationMode, currentStep]);

  useEffect(() => {
    if (navigationMode === "new") {
      setBehavioralProfile(null);
      setStudyPlan(null);
      setSelectedServerPlanId(null);
      setCurrentPlanData(null);
      setInitialTasks(undefined);
      setBackendError(undefined);
      setIsCreatingNewPlan(true);
      setCurrentStep("welcome");
    }
  }, [navigationMode]);
  if (currentStep === 'welcome') {
    return (
      <StudyPlanWelcome
        texts={texts as any}
        onStart={() => setCurrentStep('profile')}
        speakText={speakText}
        onBack={() => navigate("/dashboard")}
      />
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

  if (currentStep === 'empty') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-learning-primary/5 px-4">
        <div className="bg-card/80 backdrop-blur border border-border rounded-xl shadow-[var(--shadow-card)] p-8 max-w-md text-center space-y-4">
          <p className="text-xl font-semibold text-foreground">Você ainda não possui nenhum plano gerado.</p>
          {backendError && (
            <p className="text-sm text-destructive">Detalhes: {backendError}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Crie um novo plano para visualizar aqui. É rápido e personalizado ao seu perfil.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate("/plano-de-estudo/novo")} className="gap-2">
              Criar meu primeiro plano
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Voltar ao dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'result' && behavioralProfile && studyPlan) {
    return (
      <StudyPlanWorkspace
        serverPlans={serverPlans}
        selectedPlanId={selectedServerPlanId}
        loadingPlans={loadingServerPlans}
        onSelectPlan={handleSelectServerPlan}
        onCreateNew={handleStartOver}
        onDeletePlan={handleDeletePlan}
        deletingPlanId={deletingPlanId}
        backendError={backendError}
        behavioralProfile={behavioralProfile}
        studyPlan={studyPlan}
        learningType={currentPlanData?.learning_type || normalizeLearningType(studyPlan.objetivo_estudo)}
        serverPlanId={selectedServerPlanId ? String(selectedServerPlanId) : undefined}
        initialTasks={initialTasks}
        onNotesSaved={handleNotesSaved}
        currentPlanData={currentPlanData}
      />
    );
  }

  return null;
};

export default Index;
