import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface AccessibilityContextValue {
  accessibilityMode: boolean;
  toggleAccessibilityMode: () => void;
  announce: (message: string) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined);

export const AccessibilityProvider = ({ children }: { children: ReactNode }) => {
  const [accessibilityMode, setAccessibilityMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem("accessibilityMode");
      return stored === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const className = "accessibility-high-contrast";
    document.body.classList.toggle(className, accessibilityMode);
    try {
      localStorage.setItem("accessibilityMode", accessibilityMode ? "true" : "false");
    } catch {
      /* ignore storage failures */
    }
  }, [accessibilityMode]);

  const announce = useCallback(
    (message: string) => {
      if (!accessibilityMode || typeof window === "undefined" || !message?.trim()) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = "pt-BR";
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.warn("Falha ao anunciar via speechSynthesis", error);
      }
    },
    [accessibilityMode]
  );

  const toggleAccessibilityMode = useCallback(() => {
    setAccessibilityMode((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      accessibilityMode,
      toggleAccessibilityMode,
      announce,
    }),
    [accessibilityMode, toggleAccessibilityMode, announce]
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
};

export const useAccessibility = () => {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return ctx;
};
