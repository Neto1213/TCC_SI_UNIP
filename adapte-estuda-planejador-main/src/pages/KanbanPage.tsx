import { useEffect, useState } from 'react';
import KanbanBoard from '@/components/KanbanBoard';
import { listPlans, getPlan } from '@/lib/api';

export default function KanbanPage() {
  const [tasks, setTasks] = useState<{ id: string; title: string }[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      try {
        const plans = await listPlans();
        if (!Array.isArray(plans) || plans.length === 0) {
          setError('Nenhum plano encontrado. Gere um plano no formulário.');
          setLoading(false);
          return;
        }
        const latest = await getPlan(plans[0].id);
        const flattened: { id: string; title: string }[] = latest.cards?.map(card => ({
          id: card.id || crypto.randomUUID(),
          title: card.title || 'Tarefa',
        })) ?? [];
        setTasks(flattened);
      } catch (e: any) {
        setError(e?.message || 'Falha ao carregar seus planos');
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando quadro…</div>;
  }
  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }
  return (
    <div className="min-h-screen bg-background">
      <KanbanBoard tasks={tasks || []} />
    </div>
  );
}
