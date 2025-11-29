interface CollectReadableTextOptions {
  fallback?: string;
  includePage?: boolean;
}

export function collectReadableText(options?: CollectReadableTextOptions): string {
  const fallback = options?.fallback?.trim() ?? "";

  if (typeof document === "undefined") return fallback;

  // Give priority to any text the user selected explicitly.
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();
  if (selectedText) return selectedText;

  // If not asked to read the whole page, return only the provided fallback.
  if (options?.includePage === false) return fallback;

  const markedNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-elevenlabs-readable]"));
  const targets = markedNodes.length
    ? markedNodes
    : ([document.querySelector("main"), document.body].filter(Boolean) as HTMLElement[]);

  const collected = targets
    .map((node) => (node.innerText || node.textContent || "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  if (collected) return collected;
  return fallback;
}
