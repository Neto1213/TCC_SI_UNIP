import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, GripVertical } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  number: number;
}

interface Column {
  id: string;
  title: string;
  color: string;
  tasks: Task[];
}

type SeedTask = { id: string; title: string };
interface KanbanBoardProps { tasks?: SeedTask[] }

const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks }) => {
  const buildInitialColumns = (seed?: SeedTask[]): Record<string, Column> => {
    const seedList: SeedTask[] = seed && seed.length > 0
      ? seed
      : [
          { id: 'task-1', title: 'Estudar React Hooks' },
          { id: 'task-2', title: 'Implementar Dashboard' },
          { id: 'task-3', title: 'Revisar Componentes' },
          { id: 'task-4', title: 'Testar API Integration' },
        ];
    const novoTasks: Task[] = seedList.map((t, idx) => ({ id: t.id, title: t.title, number: idx + 1 }));
    return {
      novo: { id: 'novo', title: 'Novo', color: 'destructive', tasks: novoTasks },
      pendentes: { id: 'pendentes', title: 'Pendentes', color: 'warning', tasks: [] },
      concluidos: { id: 'concluidos', title: 'Concluídos', color: 'success', tasks: [] },
    };
  };

  const [columns, setColumns] = useState<Record<string, Column>>(buildInitialColumns(tasks));

  useEffect(() => { if (tasks) setColumns(buildInitialColumns(tasks)); }, [tasks]);

  const onDragEnd = (result: any) => {
    if (!result.destination) return;

    const { source, destination } = result;

    if (source.droppableId !== destination.droppableId) {
      // Mover entre colunas
      const sourceColumn = columns[source.droppableId];
      const destColumn = columns[destination.droppableId];
      const sourceTasks = [...sourceColumn.tasks];
      const destTasks = [...destColumn.tasks];
      const [removed] = sourceTasks.splice(source.index, 1);
      destTasks.splice(destination.index, 0, removed);

      setColumns({
        ...columns,
        [source.droppableId]: { ...sourceColumn, tasks: sourceTasks },
        [destination.droppableId]: { ...destColumn, tasks: destTasks },
      });
    } else {
      // Mover dentro da mesma coluna  
      const column = columns[source.droppableId];
      const copiedTasks = [...column.tasks];
      const [removed] = copiedTasks.splice(source.index, 1);
      copiedTasks.splice(destination.index, 0, removed);

      setColumns({
        ...columns,
        [source.droppableId]: { ...column, tasks: copiedTasks },
      });
    }
  };

  const addTask = (columnId: string) => {
    const allNumbers = Object.values(columns).flatMap(col => col.tasks.map(t => t.number));
    const newTaskNumber = (allNumbers.length ? Math.max(...allNumbers) : 0) + 1;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: `Nova Tarefa ${newTaskNumber}`,
      number: newTaskNumber
    };

    setColumns({
      ...columns,
      [columnId]: {
        ...columns[columnId],
        tasks: [...columns[columnId].tasks, newTask]
      }
    });
  };

  const getColumnStyles = (columnId: string) => {
    switch (columnId) {
      case 'novo':
        return 'border-destructive/20 bg-destructive/5';
      case 'pendentes':
        return 'border-[hsl(var(--learning-warning))]/20 bg-[hsl(var(--learning-warning))]/5';
      case 'concluidos':
        return 'border-[hsl(var(--learning-success))]/20 bg-[hsl(var(--learning-success))]/5';
      default:
        return '';
    }
  };

  const getBadgeVariant = (columnId: string) => {
    switch (columnId) {
      case 'novo':
        return 'destructive';
      case 'pendentes':
        return 'outline';
      case 'concluidos':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Kanban Board</h1>
      
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.values(columns).map((column) => (
            <div key={column.id} className={`rounded-lg border-2 p-4 ${getColumnStyles(column.id)}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">{column.title}</h2>
                <Badge variant={getBadgeVariant(column.id)} className="text-xs">
                  {column.tasks.length}
                </Badge>
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[200px] space-y-3 ${
                      snapshot.isDraggingOver ? 'bg-muted/50 rounded-md' : ''
                    }`}
                  >
                    {column.tasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`cursor-pointer hover:shadow-md transition-shadow ${
                              snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                            }`}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium">
                                  #{task.number} {task.title}
                                </CardTitle>
                                <div {...provided.dragHandleProps}>
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <Badge 
                                variant={getBadgeVariant(column.id)}
                                className="text-xs"
                              >
                                {column.title}
                              </Badge>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              <Button
                onClick={() => addTask(column.id)}
                variant="outline"
                size="sm"
                className="w-full mt-4 border-dashed"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Tarefa
              </Button>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};

export default KanbanBoard;