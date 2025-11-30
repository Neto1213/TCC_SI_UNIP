import { useAccessibility } from "@/hooks/useAccessibility";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Contrast } from "lucide-react";

export const AccessibilityToggle = () => {
  const { accessibilityMode, toggleAccessibilityMode } = useAccessibility();
  const { voiceOn, toggleVoice } = useLanguage();

  const bothOn = accessibilityMode && voiceOn;
  const anyOn = accessibilityMode || voiceOn;

  const handleToggle = () => {
    const target = !bothOn; // when off or partially on, turn everything on; otherwise turn all off
    if (accessibilityMode !== target) toggleAccessibilityMode();
    if (voiceOn !== target) toggleVoice();
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 items-start">
      <Button
        type="button"
        onClick={handleToggle}
        aria-pressed={anyOn}
        aria-label={bothOn ? "Desativar acessibilidade e áudio" : "Ativar acessibilidade com áudio"}
        title={bothOn ? "Desativar acessibilidade e áudio" : "Ativar acessibilidade com áudio"}
        variant="outline"
        className="shadow-md bg-card/90 backdrop-blur border-border hover:bg-muted"
      >
        <span className="flex items-center gap-2">
          <Contrast className="h-4 w-4" />
          Acessibilidade
          {bothOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </span>
      </Button>
      <span className="sr-only">
        {bothOn
          ? "Modo acessível e leitura em voz ativa."
          : "Modo acessível e leitura em voz desativados."}
      </span>
    </div>
  );
};
