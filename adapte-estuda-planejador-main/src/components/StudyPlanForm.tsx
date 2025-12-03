import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Clock, Target, TrendingUp } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface StudyPlanFormProps {
  onComplete: (plan: StudyPlan) => void;
}

export interface StudyPlan {
  tema_estudo: string;
  conhecimento_tema: 'iniciante' | 'intermediario' | 'avancado';
  tempo_semanal: number;
  objetivo_estudo: 'prova' | 'projeto' | 'habito' | 'aprendizado_profundo';
}

const StudyPlanForm: React.FC<StudyPlanFormProps> = ({ onComplete }) => {
  const { texts, speakText } = useLanguage();
  const [plan, setPlan] = useState<Partial<StudyPlan>>({
    tema_estudo: '',
    tempo_semanal: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid()) {
      onComplete(plan as StudyPlan);
    }
  };

  const isFormValid = () => {
    return plan.tema_estudo && 
           plan.conhecimento_tema && 
           plan.tempo_semanal && 
           plan.tempo_semanal > 0 && 
           plan.objetivo_estudo;
  };

  const conhecimentoOptions = [
    { 
      value: "iniciante", 
      label: texts.beginner, 
      description: texts.beginnerDesc,
      icon: "🌱"
    },
    { 
      value: "intermediario", 
      label: texts.intermediate, 
      description: texts.intermediateDesc,
      icon: "🌿"
    },
    { 
      value: "avancado", 
      label: texts.advanced, 
      description: texts.advancedDesc,
      icon: "🌳"
    }
  ];

  const objetivoOptions = [
    { 
      value: "prova", 
      label: texts.examPrep, 
      description: texts.examPrepDesc,
      icon: "📝"
    },
    { 
      value: "projeto", 
      label: texts.projectApp, 
      description: texts.projectAppDesc,
      icon: "🚀"
    },
    { 
      value: "habito", 
      label: texts.studyHabit, 
      description: texts.studyHabitDesc,
      icon: "📚"
    },
    { 
      value: "aprendizado_profundo", 
      label: texts.deepLearning, 
      description: texts.deepLearningDesc,
      icon: "🧠"
    }
  ];

  useEffect(() => {
    speakText(`${texts.studyPlanConfiguration}. ${texts.defineStudyObjectiveDetails}`);
  }, [texts, speakText]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-learning-primary to-learning-success bg-clip-text text-transparent">
          {texts.studyPlanConfiguration}
        </h2>
        <p className="text-muted-foreground mt-2">
          {texts.defineStudyObjectiveDetails}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="shadow-[var(--shadow-card)] border-0 bg-gradient-to-br from-card to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-learning-primary" />
              {texts.studyInformation}
            </CardTitle>
            <CardDescription>
              {texts.tellUsWhatYouWantToLearn}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Tema de Estudo */}
            <div className="space-y-3">
              <Label htmlFor="tema" className="text-base font-semibold">
                {texts.studyTopic}
              </Label>
              <Textarea
                id="tema"
                placeholder={texts.topicPlaceholder}
                value={plan.tema_estudo}
                onChange={(e) => setPlan(prev => ({ ...prev, tema_estudo: e.target.value }))}
                onFocus={() => speakText(`${texts.studyTopic}. ${texts.tellUsWhatYouWantToLearn}`)}
                className="min-h-[80px]"
              />
            </div>

            {/* Nível de Conhecimento */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                {texts.currentKnowledgeLevel}
              </Label>
              <RadioGroup 
                value={plan.conhecimento_tema ?? ''} 
                onValueChange={(value) => setPlan(prev => ({ ...prev, conhecimento_tema: value as any }))}
                className="space-y-3"
              >
                {conhecimentoOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-start space-x-4 p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                      plan.conhecimento_tema === option.value
                        ? 'border-learning-success bg-learning-success/5 shadow-[var(--shadow-success)]'
                        : 'border-border hover:border-learning-success/50'
                    }`}
                    onClick={() => {
                      setPlan(prev => ({ ...prev, conhecimento_tema: option.value as any }));
                      speakText(`${option.label}. ${option.description}`);
                    }}
                  >
                    <RadioGroupItem value={option.value} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{option.icon}</span>
                        <Label className="text-base font-semibold cursor-pointer">{option.label}</Label>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Tempo Semanal */}
            <div className="space-y-3">
              <Label htmlFor="tempo" className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {texts.weeklyAvailableTime}
              </Label>
              <div className="flex items-center space-x-4">
                <Input
                  id="tempo"
                  type="number"
                  min="7"
                  max="112"
                  placeholder="Ex: 10"
                  value={plan.tempo_semanal || ''}
                  onChange={(e) => setPlan(prev => ({ ...prev, tempo_semanal: parseInt(e.target.value) || 0 }))}
                  className="w-32"
                />
                <span className="text-muted-foreground">{texts.hoursPerWeek}</span>
              </div>
            </div>

            {/* Objetivo */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Target className="h-4 w-4" />
                {texts.mainStudyObjective}
              </Label>
              <RadioGroup 
                value={plan.objetivo_estudo ?? ''} 
                onValueChange={(value) => setPlan(prev => ({ ...prev, objetivo_estudo: value as any }))}
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                {objetivoOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                      plan.objetivo_estudo === option.value
                        ? 'border-learning-creative bg-learning-creative/5 shadow-[var(--shadow-elegant)]'
                        : 'border-border hover:border-learning-creative/50'
                    }`}
                    onClick={() => {
                      setPlan(prev => ({ ...prev, objetivo_estudo: option.value as any }));
                      speakText(`${option.label}. ${option.description}`);
                    }}
                  >
                    <RadioGroupItem value={option.value} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{option.icon}</span>
                        <Label className="text-sm font-semibold cursor-pointer">{option.label}</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Button
              type="submit"
              disabled={!isFormValid()}
              className="w-full bg-gradient-to-r from-learning-success to-learning-primary hover:opacity-90 transition-opacity py-6 text-lg"
            >
              <TrendingUp className="mr-2 h-5 w-5" />
              {texts.generatePersonalizedStudyPlan}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default StudyPlanForm;