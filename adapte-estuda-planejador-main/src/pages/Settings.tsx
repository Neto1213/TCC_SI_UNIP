import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/hooks/useLanguage";
import { useAccessibility } from "@/hooks/useAccessibility";
import { Volume2, VolumeX, Home, ArrowLeftRight } from "lucide-react";

const Settings = () => {
  const { voiceOn, toggleVoice, voiceVolume, setVoiceVolume } = useLanguage();
  const { accessibilityMode, toggleAccessibilityMode } = useAccessibility();
  const navigate = useNavigate();

  const sliderValue = useMemo(() => Math.round((voiceVolume || 0) * 100), [voiceVolume]);

  const handleVolumeChange = (values: number[]) => {
    const value = values?.[0] ?? 0;
    setVoiceVolume(Math.min(1, Math.max(0, value / 100)));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-learning-primary/5">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Preferências de acessibilidade</p>
            <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
            <p className="text-muted-foreground mt-2">Ajuste o modo de acessibilidade e o volume da voz de leitura.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Voltar
            </Button>
            <Button variant="secondary" onClick={() => navigate("/dashboard")} className="gap-2">
              <Home className="h-4 w-4" />
              Início
            </Button>
          </div>
        </div>

        <Card className="shadow-[var(--shadow-card)] border-learning-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {voiceOn ? <Volume2 className="h-5 w-5 text-learning-primary" /> : <VolumeX className="h-5 w-5 text-muted-foreground" />}
              Acessibilidade e voz
            </CardTitle>
            <CardDescription>Ajuste o volume da narração.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Volume</span>
                <span className="text-muted-foreground">{sliderValue}%</span>
              </div>
              <Slider
                value={[sliderValue]}
                onValueChange={handleVolumeChange}
                max={100}
                step={5}
                aria-label="Volume da voz"
              />
              <p className="text-xs text-muted-foreground">Diminua para deixar a narração mais suave durante o uso.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
