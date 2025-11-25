import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronRight, Brain, Target, Clock, TrendingUp } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface BehavioralProfileProps {
  onComplete: (profile: BehavioralProfile) => void;
}

export interface BehavioralProfile {
  estilo_aprendizado: 'teorico' | 'pratico' | 'balanceado' | 'intensivo';
  tolerancia_dificuldade: 'baixa' | 'media' | 'alta';
  nivel_foco: 'curto' | 'medio' | 'longo';
  resiliencia_estudo: 'baixa' | 'media' | 'alta';
}

const BehavioralProfile: React.FC<BehavioralProfileProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [profile, setProfile] = useState<Partial<BehavioralProfile>>({});
  const { texts, speakText } = useLanguage();

  const steps = useMemo(() => [
    {
      title: texts.learningStyleTitle,
      description: texts.learningStyleDesc,
      field: "estilo_aprendizado" as keyof BehavioralProfile,
      icon: Brain,
      options: [
        { value: "teorico", label: texts.theoreticalLabel, description: texts.theoreticalDesc },
        { value: "pratico", label: texts.practicalLabel, description: texts.practicalDesc },
        { value: "balanceado", label: texts.balancedLabel, description: texts.balancedDesc },
        { value: "intensivo", label: texts.intensiveLabel, description: texts.intensiveDesc }
      ]
    },
    {
      title: texts.challengeToleranceTitle,
      description: texts.challengeToleranceDesc,
      field: "tolerancia_dificuldade" as keyof BehavioralProfile,
      icon: Target,
      options: [
        { value: "baixa", label: texts.toleranceLowLabel, description: texts.toleranceLowDesc },
        { value: "media", label: texts.toleranceMediumLabel, description: texts.toleranceMediumDesc },
        { value: "alta", label: texts.toleranceHighLabel, description: texts.toleranceHighDesc }
      ]
    },
    {
      title: texts.focusDisciplineTitle,
      description: texts.focusDisciplineDesc,
      field: "nivel_foco" as keyof BehavioralProfile,
      icon: Clock,
      options: [
        { value: "curto", label: texts.focusShortLabel, description: texts.focusShortDesc },
        { value: "medio", label: texts.focusMediumLabel, description: texts.focusMediumDesc },
        { value: "longo", label: texts.focusLongLabel, description: texts.focusLongDesc }
      ]
    },
    {
      title: texts.studyResilienceTitle,
      description: texts.studyResilienceDesc,
      field: "resiliencia_estudo" as keyof BehavioralProfile,
      icon: TrendingUp,
      options: [
        { value: "baixa", label: texts.resilienceLowLabel, description: texts.resilienceLowDesc },
        { value: "media", label: texts.resilienceMediumLabel, description: texts.resilienceMediumDesc },
        { value: "alta", label: texts.resilienceHighLabel, description: texts.resilienceHighDesc }
      ]
    }
  ], [texts]);

  const handleOptionSelect = (value: string) => {
    const field = steps[currentStep].field;
    setProfile(prev => ({ ...prev, [field]: value }));
    const opt = steps[currentStep].options.find(o => o.value === value);
    if (opt) speakText(`${opt.label}. ${opt.description}`);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(profile as BehavioralProfile);
    }
  };

  const currentStepData = steps[currentStep];
  const IconComponent = currentStepData.icon;
  const selectedValue = profile[currentStepData.field];

  useEffect(() => {
    speakText(`${texts.behavioralProfileTitle}. ${texts.step} ${currentStep + 1} ${texts.of} ${steps.length}. ${currentStepData.title}. ${currentStepData.description}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, texts]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-learning-primary to-learning-creative bg-clip-text text-transparent">
          {texts.behavioralProfileTitle}
        </h2>
        <p className="text-muted-foreground mt-2">
          {texts.step} {currentStep + 1} {texts.of} {steps.length}
        </p>
      </div>

      <Card className="shadow-[var(--shadow-card)] border-0 bg-gradient-to-br from-card to-background">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-learning-primary to-learning-creative p-4 mb-4">
            <IconComponent className="w-full h-full text-white" />
          </div>
          <CardTitle className="text-2xl">{currentStepData.title}</CardTitle>
          <CardDescription className="text-lg">{currentStepData.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={selectedValue ?? ''} onValueChange={handleOptionSelect} className="space-y-4">
            {currentStepData.options.map((option) => (
              <div
                key={option.value}
                className={`flex items-start space-x-4 p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                  selectedValue === option.value
                    ? 'border-learning-primary bg-learning-primary/5 shadow-[var(--shadow-elegant)]'
                    : 'border-border hover:border-learning-primary/50'
                }`}
                onClick={() => handleOptionSelect(option.value)}
              >
                <RadioGroupItem value={option.value} className="mt-1" />
                <div className="flex-1">
                  <Label className="text-base font-semibold cursor-pointer">{option.label}</Label>
                  <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>

          <div className="flex justify-between items-center pt-6">
            <p className="text-sm text-muted-foreground">
              {currentStep + 1} / {steps.length} {texts.completed}
            </p>
            <Button
              onClick={handleNext}
              disabled={!selectedValue}
              className="bg-gradient-to-r from-learning-primary to-learning-creative hover:opacity-90 transition-opacity"
            >
              {currentStep === steps.length - 1 ? texts.finishProfile : texts.next}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BehavioralProfile;