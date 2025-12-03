import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { BehavioralProfile } from "./BehavioralProfile";
import { StudyPlan } from "./StudyPlanForm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/hooks/useLanguage";
import { updateCardNotes, updateCardStatus } from '@/lib/api';
import { toast } from "@/components/ui/use-toast";
import {
  Clock,
  Target,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  GripVertical,
  Info,
  RefreshCw,
  Star,
  CircleCheckBig,
} from "lucide-react";
import { useAccessibility } from "@/hooks/useAccessibility";

const boardPresets: Record<string, string[]> = {
  prova: ["A estudar", "Em revisão", "Dominei"],
  habito: ["Planejado", "Fazendo", "Consolidado"],
  profundo: ["Explorar", "Praticar", "Aplicar", "Refletir"],
  apresentacao: ["Pesquisa", "Rascunho", "Revisão", "Pronto"],
  default: ["Novo", "Pendente", "Concluído"],
};

const slugify = (label: string) =>
  label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "coluna";

interface StudyPlanGeneratorProps {
  behavioralProfile: BehavioralProfile;
  studyPlan: StudyPlan;
  learningType?: string;
  onStartOver: () => void;
  onUpdateColumns?: (columns: Record<string, KanbanColumn>) => void;
  initialTasks?: Task[];
  serverPlanId?: string;
  onNotesSaved?: () => void | Promise<void>;
}

export interface Task {
  id: string;
  title: string;
  type?: string;
  description?: string;
  instructions?: string;
  hoursLabel?: string;
  effortMinutes?: number;
  stageSuggestion?: string;
  needsReview?: boolean;
  reviewAfterDays?: number;
  columnKey: string;
  week?: number;
  notes?: string;
  depends_on?: string[];
  order?: number;
}

interface KanbanColumn {
  id: string;
  title: string;
  tasks: Task[];
}

const StudyPlanGenerator: React.FC<StudyPlanGeneratorProps> = ({
  behavioralProfile,
  studyPlan,
  learningType = "default",
  serverPlanId,
  onStartOver,
  onUpdateColumns,
  initialTasks,
  onNotesSaved,
}) => {
  const { texts, speakText } = useLanguage();
  const { accessibilityMode, announce } = useAccessibility();
  const dragLocationRef = useRef<string | null>(null);

  useEffect(() => {
    speakText(`${texts.studyPlanKanban}. ${texts.learningJourneyProgressiveStages}`);
  }, [texts, speakText]);

  const presetColumns = useMemo(() => {
    const labels = boardPresets[learningType] || boardPresets.default;
    return labels.map((label) => ({ id: slugify(label), title: label }));
  }, [learningType]);

  const normalizeTasks = useCallback(
    (tasksList: Task[] = []): Task[] => {
      const fallbackColumn = presetColumns[0]?.id || "novo";
      return tasksList
        .map((task) => ({
          ...task,
          columnKey: task.columnKey || fallbackColumn,
        }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    [presetColumns]
  );

  const tasksSource = useMemo<Task[]>(() => normalizeTasks(initialTasks || []), [initialTasks, normalizeTasks]);

  const buildColumns = useCallback(
    (tasksList: Task[]): Record<string, KanbanColumn> => {
      const base: Record<string, KanbanColumn> = {};
      presetColumns.forEach((col) => {
        base[col.id] = { id: col.id, title: col.title, tasks: [] };
      });
      if (!base.default) {
        base.default = { id: "default", title: "Outros", tasks: [] };
      }
      for (const task of tasksList) {
        const column = base[task.columnKey] || base[presetColumns[0]?.id || "default"];
        column.tasks.push(task);
      }
      return base;
    },
    [presetColumns]
  );

  const [columns, setColumns] = useState<Record<string, KanbanColumn>>(() =>
    buildColumns(tasksSource)
  );

  useEffect(() => {
    setColumns(buildColumns(tasksSource));
  }, [tasksSource, buildColumns]);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [noteInput, setNoteInput] = useState<string>("");

  const openTaskModal = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  useEffect(() => {
    setNoteInput(selectedTask?.notes || "");
  }, [selectedTask]);

  const columnOrder = useMemo(() => presetColumns.map((c) => c.id), [presetColumns]);
  const columnTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    presetColumns.forEach((c) => {
      map[c.id] = c.title;
    });
    return map;
  }, [presetColumns]);
  const finalColumnId = columnOrder[columnOrder.length - 1] || "default";
  const inProgressColumnId = columnOrder[1] || columnOrder[0] || finalColumnId;
  // Constrói uma lista plana de tarefas para calcular recomendações/ordem mínima.
  const allTasks = useMemo(
    () => columnOrder.flatMap((id) => columns[id]?.tasks || []),
    [columns, columnOrder]
  );
  const pendingTasks = useMemo(
    () => allTasks.filter((task) => task.columnKey !== finalColumnId),
    [allTasks, finalColumnId]
  );
  const recommendedTask = useMemo(() => {
    // card recomendado = menor ordem que ainda não está na coluna final
    if (!pendingTasks.length) return null;
    return [...pendingTasks].sort(
      (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
    )[0];
  }, [pendingTasks]);
  const earliestPendingTask = recommendedTask;

  useEffect(() => {
    if (!selectedTask) return;
    const updated = allTasks.find((task) => task.id === selectedTask.id);
    if (updated && (updated.columnKey !== selectedTask.columnKey || updated.notes !== selectedTask.notes)) {
      setSelectedTask(updated);
    }
  }, [allTasks, selectedTask]);

  const handleDragStart = (start: any) => {
    dragLocationRef.current = `${start?.source?.droppableId || ""}-${start?.source?.index ?? ""}`;
    if (!accessibilityMode) return;
    const task = columns[start?.source?.droppableId]?.tasks?.[start?.source?.index];
    if (task) {
      announce(`Item ${task.title} selecionado para arrastar.`);
    }
  };

  const handleDragUpdate = (update: any) => {
    if (!accessibilityMode || !update.destination) return;
    const locationKey = `${update.destination.droppableId}-${update.destination.index}`;
    if (locationKey === dragLocationRef.current) return;
    dragLocationRef.current = locationKey;
    const columnName = columnTitleMap[update.destination.droppableId] || update.destination.droppableId;
    const destinationTasks = columns[update.destination.droppableId]?.tasks || [];
    const previousTask = destinationTasks[update.destination.index - 1];
    const relativePosition = previousTask ? `Posicionado abaixo de ${previousTask.title}.` : "Posicionado no topo.";
    announce(`Movendo para ${columnName}. ${relativePosition}`);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) {
      dragLocationRef.current = null;
      return;
    }
    const { source, destination } = result;
    const sourceColumn = columns[source.droppableId];
    const destColumn = columns[destination.droppableId];
    if (!sourceColumn || !destColumn) return;

    const movedTask = sourceColumn.tasks[source.index];
    if (!movedTask) return;

    if (
      destination.droppableId === finalColumnId &&
      earliestPendingTask &&
      movedTask.order !== undefined &&
      (movedTask.order ?? Number.MAX_SAFE_INTEGER) > (earliestPendingTask.order ?? Number.MAX_SAFE_INTEGER) &&
      movedTask.id !== earliestPendingTask.id
    ) {
      toast({
        title: "Ordem sugerida pulada",
        description: `Recomendado concluir antes: "${earliestPendingTask.title}".`,
      });
    }

    const updatedColumns = { ...columns };
    const sourceTasks = [...sourceColumn.tasks];
    const destTasks = source.droppableId === destination.droppableId ? sourceTasks : [...destColumn.tasks];
    const [removed] = sourceTasks.splice(source.index, 1);
    if (!removed) return;

    removed.columnKey = destination.droppableId;
    destTasks.splice(destination.index, 0, removed);

    updatedColumns[source.droppableId] = { ...sourceColumn, tasks: sourceTasks };
    updatedColumns[destination.droppableId] = {
      ...destColumn,
      tasks: destTasks,
    };

    setColumns(updatedColumns);
    onUpdateColumns?.(updatedColumns);

    if (accessibilityMode) {
      const columnName = columnTitleMap[destination.droppableId] || destination.droppableId;
      announce(`Item ${removed.title} movido para ${columnName}, posição ${destination.index + 1}.`);
    }
    dragLocationRef.current = null;

    if (serverPlanId) {
      const planNumericId = Number(serverPlanId);
      if (!Number.isNaN(planNumericId)) {
        updateCardStatus(planNumericId, removed.week ?? 1, removed.id, removed.columnKey).catch(() => {
          /* best-effort */
        });
      }
    }
  };

  const typeStyle = (type?: string) => {
    switch (type) {
      case "fundamento":
        return "bg-learning-primary/10 text-learning-primary border-learning-primary/30";
      case "pratica":
        return "bg-learning-success/10 text-learning-success border-learning-success/30";
      case "revisao":
        return "bg-learning-creative/10 text-learning-creative border-learning-creative/30";
      case "aplicacao":
        return "bg-learning-warning/10 text-learning-warning border-learning-warning/30";
      case "entrega":
        return "bg-learning-ink/10 text-learning-ink border-learning-ink/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };
  const typeLabel = (type?: string) => {
    switch (type) {
      case "fundamento":
        return "Fundamento";
      case "pratica":
        return "Prática";
      case "revisao":
        return "Revisão";
      case "aplicacao":
        return "Aplicação";
      case "entrega":
        return "Entrega";
      default:
        return "Atividade";
    }
  };

  // Atualiza o columnKey de um card localmente e sincroniza best-effort com o backend.
  const moveTaskToColumn = useCallback(
    (taskId: string, targetColumnId: string) => {
      let updatedSnapshot: Record<string, KanbanColumn> | null = null;
      let movedTaskData: Task | null = null;
      setColumns((prev) => {
        const updated = { ...prev };
        let found = false;
        for (const colId of Object.keys(updated)) {
          const col = updated[colId];
          const idx = col.tasks.findIndex((task) => task.id === taskId);
          if (idx !== -1) {
            const sourceTasks = [...col.tasks];
            const [taskData] = sourceTasks.splice(idx, 1);
            updated[colId] = { ...col, tasks: sourceTasks };
            const targetColumn = updated[targetColumnId] || {
              id: targetColumnId,
              title: columnTitleMap[targetColumnId] || targetColumnId,
              tasks: [],
            };
            const targetTasks = [...targetColumn.tasks, { ...taskData, columnKey: targetColumnId }];
            movedTaskData = { ...taskData, columnKey: targetColumnId };
            updated[targetColumnId] = { ...targetColumn, tasks: targetTasks };
            found = true;
            break;
          }
        }
        if (!found) {
          updatedSnapshot = null;
          return prev;
        }
        updatedSnapshot = updated;
        return updated;
      });

      if (updatedSnapshot) {
        onUpdateColumns?.(updatedSnapshot);
      }
      if (movedTaskData) {
        setSelectedTask((task) => (task && task.id === movedTaskData!.id ? movedTaskData : task));
        if (serverPlanId) {
          const planNumericId = Number(serverPlanId);
          if (!Number.isNaN(planNumericId)) {
            updateCardStatus(planNumericId, movedTaskData.week ?? 1, movedTaskData.id, movedTaskData.columnKey).catch(
              () => {
                /* best-effort */
              }
            );
          }
        }
      }
    },
    [columnTitleMap, onUpdateColumns, serverPlanId]
  );

  const handleStartTask = () => {
    if (!selectedTask) return;
    moveTaskToColumn(selectedTask.id, inProgressColumnId);
  };

  const handleCompleteTask = () => {
    if (!selectedTask) return;
    if (
      earliestPendingTask &&
      selectedTask.id !== earliestPendingTask.id &&
      (selectedTask.order ?? Number.MAX_SAFE_INTEGER) > (earliestPendingTask.order ?? Number.MAX_SAFE_INTEGER)
    ) {
      toast({
        title: "Sugestão de ordem",
        description: `Recomendado concluir antes: "${earliestPendingTask.title}".`,
      });
    }
    moveTaskToColumn(selectedTask.id, finalColumnId);
  };


  async function handleSaveNotes() {
    if (!selectedTask) return;
    if (!serverPlanId) {
      alert("Selecione um plano salvo no servidor para registrar anotações.");
      return;
    }
    const planNumericId = Number(serverPlanId);
    if (Number.isNaN(planNumericId)) {
      alert("Plano inválido para salvar anotações.");
      return;
    }
    const semana = selectedTask.week ?? 1;
    try {
      await updateCardNotes(planNumericId, semana, selectedTask.id, noteInput);
      setColumns(prev => {
        const copy = { ...prev };
        for (const colId of Object.keys(copy)) {
          copy[colId].tasks = copy[colId].tasks.map(t => t.id === selectedTask.id ? { ...t, notes: noteInput } : t);
        }
        return copy;
      });
      setSelectedTask(t => t ? { ...t, notes: noteInput } : t);
      await onNotesSaved?.();
      alert("Anotações salvas.");
    } catch (e:any) {
      alert(e?.message || "Falha ao salvar anotações");
    }
  }

  const formatEffort = (minutes?: number) => {
    if (!minutes) return "60 min";
    if (minutes < 60) return `${minutes} min`;
    const hours = minutes / 60;
    return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
  };

  const tempoSemanalLabel = useMemo(() => {
    const raw = (studyPlan as any)?.tempo_semanal;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return "—";
    return `${value}h/semana`;
  }, [studyPlan]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-learning-primary via-learning-success to-learning-creative bg-clip-text text-transparent mb-4">
          Plano de Estudos quadros kanban
        </h1>
        <p className="text-xl text-muted-foreground mb-6">
          Organize suas tarefas de estudo de forma visual e eficiente
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <Badge variant="outline" className="text-base py-2 px-4">
            📚 {studyPlan.tema_estudo}
          </Badge>
          <Badge variant="outline" className="text-base py-2 px-4">
            ⏱️ {tempoSemanalLabel}
          </Badge>
          <Badge variant="outline" className="text-base py-2 px-4">
            🎯 {studyPlan.objetivo_estudo.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      {/* Kanban Board */}
      {recommendedTask && (
        <div className="rounded-lg border border-learning-primary/40 bg-learning-primary/5 p-4 flex flex-col gap-1">
          <p className="text-sm font-semibold text-learning-primary">
            Sugestão: comece por "{recommendedTask.title}"
            {recommendedTask.week ? ` (Semana ${recommendedTask.week})` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Ordem #{recommendedTask.order ?? "—"} · Coluna atual:{" "}
            {columnTitleMap[recommendedTask.columnKey] || recommendedTask.columnKey}
          </p>
        </div>
      )}

      <DragDropContext onDragStart={handleDragStart} onDragUpdate={handleDragUpdate} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {presetColumns.map(({ id, title }) => {
            const column = columns[id] || { id, title, tasks: [] };
            return (
              <div key={id} className="space-y-4">
                <div className="p-4 rounded-lg border bg-background/70 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {id === finalColumnId ? "Conclua quando finalizar o ciclo" : "Organize conforme o progresso"}
                      </p>
                    </div>
                    <Badge variant="outline">{column.tasks.length}</Badge>
                  </div>
                </div>

                <Droppable droppableId={id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`space-y-3 min-h-[300px] rounded-lg p-2 ${
                        snapshot.isDraggingOver ? 'bg-muted/30' : 'bg-muted/10'
                      }`}
                    >
                      {column.tasks.map((task, taskIdx) => {
                        const isRecommended = recommendedTask?.id === task.id;
                        const isInProgress = task.columnKey === inProgressColumnId;
                        const isCompleted = task.columnKey === finalColumnId;
                        const minutesLabel = task.hoursLabel || formatEffort(task.effortMinutes);
                        return (
                          <Draggable key={task.id} draggableId={task.id} index={taskIdx}>
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => openTaskModal(task)}
                                className={`cursor-grab active:cursor-grabbing border-l-4 transition ${
                                  snapshot.isDragging ? 'shadow-lg rotate-1 scale-[1.01]' : 'hover:shadow-md'
                                } ${isInProgress ? 'border-l-learning-warning' : ''} ${
                                  isCompleted ? 'border-l-learning-success' : ''
                                } ${isRecommended ? 'ring-2 ring-learning-primary/40' : ''} ${
                                  isCompleted ? 'bg-learning-success/10' : ''
                                }`}
                                style={provided.draggableProps.style}
                              >
                                <CardContent className="p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className="text-muted-foreground hover:text-foreground">
                                        <GripVertical className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">#{task.order ?? taskIdx + 1}</p>
                                        <h4 className="font-semibold text-sm">{task.title}</h4>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <Badge className={`text-[10px] ${typeStyle(task.type)}`}>
                                        {typeLabel(task.type)}
                                      </Badge>
                                      {isRecommended && (
                                        <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
                                          <Star className="h-3 w-3" />
                                          Comece por aqui
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-3">
                                    {task.description}
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-[11px]">
                                    {task.week && (
                                      <Badge variant="outline" className="text-[10px]">
                                        Semana {task.week}
                                      </Badge>
                                    )}
                                    {minutesLabel && (
                                      <Badge variant="outline" className="text-[10px]">
                                        ~{minutesLabel}
                                      </Badge>
                                    )}
                                    {task.needsReview && (
                                      <Badge variant="outline" className="text-[10px] flex items-center gap-1 text-learning-warning border-learning-warning/40">
                                        <RefreshCw className="h-3 w-3" />
                                        Revisar
                                      </Badge>
                                    )}
                                    {isInProgress && (
                                      <Badge className="text-[10px] bg-learning-warning/15 text-learning-warning border border-learning-warning/40">
                                        Em andamento
                                      </Badge>
                                    )}
                                    {isCompleted && (
                                      <Badge className="text-[10px] bg-learning-success/15 text-learning-success border border-learning-success/40 flex items-center gap-1">
                                        <CircleCheckBig className="h-3 w-3" />
                                        Concluído
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {minutesLabel}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {task.type === 'fundamento' && <BookOpen className="h-3 w-3" />}
                                      {task.type === 'pratica' && <Target className="h-3 w-3" />}
                                      {task.type === 'revisao' && <TrendingUp className="h-3 w-3" />}
                                      {task.type === 'aplicacao' && <CheckCircle2 className="h-3 w-3" />}
                                    </div>
                                  </div>
                                  {task.needsReview && (
                                    <div className="flex items-center gap-2 text-[11px] text-learning-warning">
                                      <RefreshCw className="h-3 w-3" />
                                      Revisar em {task.reviewAfterDays ?? 2} dia(s)
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Task Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <Info className="h-4 w-4" />
              {selectedTask?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {selectedTask && (
              <div className="flex flex-wrap gap-2 text-[11px] mb-2">
                {selectedTask.week && (
                  <Badge variant="outline">Semana {selectedTask.week}</Badge>
                )}
                <Badge className={typeStyle(selectedTask.type)}>{typeLabel(selectedTask.type)}</Badge>
                <Badge variant="outline">~{formatEffort(selectedTask.effortMinutes)}</Badge>
                {selectedTask.needsReview && (
                  <Badge variant="outline" className="flex items-center gap-1 text-learning-warning border-learning-warning/40">
                    <RefreshCw className="h-3 w-3" />
                    Revisar depois
                  </Badge>
                )}
              </div>
            )}
            <p className="text-muted-foreground whitespace-pre-line">{selectedTask?.description}</p>
            {selectedTask?.instructions && (
              <div className="bg-muted/50 rounded-md p-3 text-xs whitespace-pre-line">
                <strong>Como fazer:</strong>{" "}
                <span className="text-muted-foreground">{selectedTask.instructions}</span>
              </div>
            )}
            {selectedTask?.needsReview && (
              <div className="flex items-center gap-2 text-learning-warning text-xs">
                <RefreshCw className="h-3 w-3" />
                Revisar em {selectedTask.reviewAfterDays ?? 2} dia(s) após concluir.
              </div>
            )}
            {selectedTask && (
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleStartTask}
                  disabled={
                    !selectedTask || selectedTask.columnKey === inProgressColumnId || selectedTask.columnKey === finalColumnId
                  }
                  onMouseEnter={() => speakText("Iniciar esta tarefa")}
                >
                  Começar
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCompleteTask}
                  disabled={!selectedTask || selectedTask.columnKey === finalColumnId}
                  onMouseEnter={() => speakText("Concluir esta tarefa")}
                >
                  Concluir
                </Button>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Anotações</label>
              <textarea
                className="mt-2 w-full border rounded-md p-2 text-sm"
                rows={5}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Escreva suas anotações aqui..."
              />
              <div className="mt-2 text-right">
                <Button size="sm" onClick={handleSaveNotes} onMouseEnter={() => speakText("Salvar anotações")}>
                  Salvar anotações
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudyPlanGenerator;
