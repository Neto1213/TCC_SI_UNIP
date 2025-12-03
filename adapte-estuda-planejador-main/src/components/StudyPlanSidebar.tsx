import { BookOpen, Plus, Trash2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ServerPlanSummary {
  id: number;
  plan_title?: string | null;
  tema?: string | null;
  created_at?: string | null;
}

interface StudyPlanSidebarProps {
  plans?: ServerPlanSummary[];
  selectedPlanId?: number | null;
  onSelectPlan?: (planId: number) => void;
  onCreateNew: () => void;
  loadingPlans?: boolean;
  onDeletePlan?: (planId: number) => void;
  deletingPlanId?: number | null;
}

export function StudyPlanSidebar({
  onCreateNew,
  plans = [],
  selectedPlanId,
  onSelectPlan,
  loadingPlans = false,
  onDeletePlan,
  deletingPlanId = null,
}: StudyPlanSidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const formatDate = (value?: number | string | null) => {
    if (!value && value !== 0) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarHeader className="border-b p-4">
        <Button
          onClick={onCreateNew}
          className="w-full bg-gradient-to-r from-learning-primary to-learning-creative hover:opacity-90"
          size={isCollapsed ? "icon" : "default"}
        >
          <Plus className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Novo Plano</span>}
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
            Meus Planos ({plans.length})
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <ScrollArea className="max-h-[40vh]">
              <SidebarMenu>
                {loadingPlans ? (
                  !isCollapsed && (
                    <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                      Carregando planos...
                    </div>
                  )
                ) : plans.length === 0 ? (
                  !isCollapsed && (
                    <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                      Nenhum plano armazenado ainda
                    </div>
                  )
                ) : (
                  plans.map((plan) => (
                    <SidebarMenuItem key={`server-${plan.id}`} className="relative">
                      <SidebarMenuButton
                        onClick={() => onSelectPlan?.(plan.id)}
                        isActive={selectedPlanId === plan.id}
                        className={`w-full ${onDeletePlan && !isCollapsed ? "pr-10" : ""} items-start`}
                        title={isCollapsed ? plan.plan_title || plan.tema || `Plano #${plan.id}` : undefined}
                      >
                        <BookOpen className="h-4 w-4 flex-shrink-0" />
                        {!isCollapsed && (
                          <div className="flex-1 whitespace-normal break-words text-left">
                            <div className="font-medium">
                              {plan.plan_title || plan.tema || `Plano #${plan.id}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(plan.created_at)}
                            </div>
                          </div>
                        )}
                      </SidebarMenuButton>
                      {onDeletePlan && !isCollapsed && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1.5 h-7 w-7 text-destructive hover:text-destructive"
                          title="Apagar plano"
                          disabled={deletingPlanId === plan.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePlan(plan.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
