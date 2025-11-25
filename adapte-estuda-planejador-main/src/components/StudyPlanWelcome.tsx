import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, GraduationCap, Sparkles } from "lucide-react";

type Texts = Record<string, string>;

interface StudyPlanWelcomeProps {
  texts: Texts;
  onStart: () => void;
  speakText?: (text: string) => void;
  onBack?: () => void;
}

const StudyPlanWelcome: React.FC<StudyPlanWelcomeProps> = ({ texts, onStart, speakText, onBack }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-learning-primary/5 flex items-center justify-center p-4 relative">
      {onBack && (
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao dashboard
          </Button>
        </div>
      )}
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-learning-primary to-learning-creative p-6 shadow-[var(--shadow-elegant)]">
              <GraduationCap className="w-full h-full text-white" />
            </div>
          </div>

          <h1
            className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-learning-primary via-learning-success to-learning-creative bg-clip-text text-transparent"
            onMouseEnter={() => speakText?.(texts.personalizedStudyPlan)}
          >
            {texts.personalizedStudyPlan}
          </h1>

          <p
            className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            onMouseEnter={() => speakText?.(texts.createUniquePlan)}
          >
            {texts.createUniquePlan}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="p-6 rounded-xl bg-gradient-to-br from-card to-learning-primary/5 border border-learning-primary/10 shadow-[var(--shadow-card)]">
            <div className="w-12 h-12 rounded-lg bg-learning-primary/10 flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl">🧠</span>
            </div>
            <h3 className="font-semibold mb-2" onMouseEnter={() => speakText?.(texts.behavioralAnalysis)}>
              {texts.behavioralAnalysis}
            </h3>
            <p className="text-sm text-muted-foreground" onMouseEnter={() => speakText?.(texts.identifyLearningStyle)}>
              {texts.identifyLearningStyle}
            </p>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-card to-learning-success/5 border border-learning-success/10 shadow-[var(--shadow-card)]">
            <div className="w-12 h-12 rounded-lg bg-learning-success/10 flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="font-semibold mb-2" onMouseEnter={() => speakText?.(texts.clearGoals)}>
              {texts.clearGoals}
            </h3>
            <p className="text-sm text-muted-foreground" onMouseEnter={() => speakText?.(texts.defineTopicLevel)}>
              {texts.defineTopicLevel}
            </p>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-card to-learning-creative/5 border border-learning-creative/10 shadow-[var(--shadow-card)]">
            <div className="w-12 h-12 rounded-lg bg-learning-creative/10 flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl">✨</span>
            </div>
            <h3 className="font-semibold mb-2" onMouseEnter={() => speakText?.(texts.intelligentPlan)}>
              {texts.intelligentPlan}
            </h3>
            <p className="text-sm text-muted-foreground" onMouseEnter={() => speakText?.(texts.receiveScheduleResources)}>
              {texts.receiveScheduleResources}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={onStart}
            className="bg-gradient-to-r from-learning-primary to-learning-creative hover:opacity-90 transition-opacity text-lg px-8 py-6"
            size="lg"
            onMouseEnter={() => speakText?.(texts.startAnalysis)}
          >
            <Sparkles className="mr-2 h-5 w-5" />
            {texts.startAnalysis}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          <div className="text-sm text-muted-foreground" onMouseEnter={() => speakText?.(texts.takesOnlyMinutes)}>
            {texts.takesOnlyMinutes}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyPlanWelcome;
