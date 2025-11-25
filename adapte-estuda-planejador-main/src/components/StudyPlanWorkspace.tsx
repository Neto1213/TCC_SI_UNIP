import StudyPlanGenerator, { Task as KanbanTask } from "@/components/StudyPlanGenerator";
import { StudyPlanSidebar } from "@/components/StudyPlanSidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StudyPlan } from "@/components/StudyPlanForm";
import { BehavioralProfile as BehavioralProfileType } from "@/components/BehavioralProfile";
import { useAuth } from "@/context/AuthProvider";
import { PlanDetail, PlanSummary } from "@/lib/api";
import { ArrowLeft, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface StudyPlanWorkspaceProps {
  serverPlans: PlanSummary[];
  selectedPlanId: number | null;
  loadingPlans: boolean;
  onSelectPlan: (planId: number) => void | Promise<void>;
  onCreateNew: () => void;
  onDeletePlan?: (planId: number) => void | Promise<void>;
  deletingPlanId?: number | null;
  backendError?: string;
  behavioralProfile: BehavioralProfileType;
  studyPlan: StudyPlan;
  learningType: string;
  serverPlanId?: string;
  initialTasks?: KanbanTask[];
  onNotesSaved?: () => void | Promise<void>;
  currentPlanData: PlanDetail | null;
}

const StudyPlanWorkspace: React.FC<StudyPlanWorkspaceProps> = ({
  serverPlans,
  selectedPlanId,
  loadingPlans,
  onSelectPlan,
  onCreateNew,
  onDeletePlan,
  deletingPlanId = null,
  backendError,
  behavioralProfile,
  studyPlan,
  learningType,
  serverPlanId,
  initialTasks,
  onNotesSaved,
  currentPlanData,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <StudyPlanSidebar
          plans={serverPlans}
          selectedPlanId={selectedPlanId}
          onSelectPlan={onSelectPlan}
          onCreateNew={onCreateNew}
          loadingPlans={loadingPlans}
          onDeletePlan={onDeletePlan}
          deletingPlanId={deletingPlanId}
        />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex items-center px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="mr-2">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold">Plano de Estudos</h2>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 border rounded-full px-3 py-1 text-sm hover:bg-muted">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>{(user?.email?.[0] || "U").toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">{user?.email || "Usuário"}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <div className="text-sm font-medium">{user?.email || "Usuário"}</div>
                    <div className="text-xs text-muted-foreground">
                      Perfil atual: {currentPlanData?.perfil_label || currentPlanData?.estilo || "—"}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/plano-de-estudo/novo")}>
                    Formulário
                  </DropdownMenuItem>
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
                learningType={learningType}
                serverPlanId={serverPlanId}
                onStartOver={onCreateNew}
                initialTasks={initialTasks}
                onNotesSaved={onNotesSaved}
              />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default StudyPlanWorkspace;
