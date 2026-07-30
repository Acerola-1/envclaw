import { computed, type Ref, type ComputedRef } from "vue";

export interface Artifact {
  path: string;
  name: string;
  type: "image" | "file" | "other";
  extension: string;
}

export interface ArtifactGroup {
  messageId: string;
  messageRole: string;
  messagePreview: string;
  timestamp: number;
  artifacts: Artifact[];
}

interface MinimalMessage {
  id: string;
  role: string;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

const MEDIA_RE = /MEDIA:(`[^`\n]+`|"[^"\n]+"|'[^'\n]+'|(?:[A-Za-z]:[\\/]|\/)[^\s,;)\]}:>]+\.\w+)/gi;

const IMAGE_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico",
]);

const FILE_EXTS = new Set([
  ".pdf", ".docx", ".doc", ".txt", ".md", ".xlsx", ".xls", ".csv",
  ".pptx", ".ppt", ".zip", ".tar", ".gz", ".7z", ".rar",
  ".html", ".htm", ".mp4", ".mov", ".mkv", ".webm",
  ".mp3", ".wav", ".ogg", ".opus", ".m4a", ".flac", ".epub",
]);

function getType(ext: string): "image" | "file" | "other" {
  if (IMAGE_EXTS.has(ext)) return "image";
  if (FILE_EXTS.has(ext)) return "file";
  return "other";
}

function extractName(path: string): string {
  const cleaned = path.replace(/^[`"']|[`"']$/g, "");
  const segments = cleaned.replace(/\\/g, "/").split("/");
  return segments[segments.length - 1] || cleaned;
}

function extractExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function extractPath(raw: string): string {
  return raw.replace(/^[`"']|[`"']$/g, "");
}

function parseArtifacts(content: string): Artifact[] {
  const seen = new Set<string>();
  const artifacts: Artifact[] = [];
  MEDIA_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MEDIA_RE.exec(content)) !== null) {
    const fullMatch = match[0];
    const raw = fullMatch.slice(6);
    const path = extractPath(raw);
    const name = extractName(path);
    const extension = extractExtension(name);

    if (!extension) continue;
    if (seen.has(path)) continue;
    seen.add(path);

    artifacts.push({ path, name, type: getType(extension), extension });
  }

  return artifacts;
}

function stripThinkingTags(content: string): string {
  return content.replace(/<think[\s\S]*?<\/think>/gi, "");
}

function makePreview(content: string, maxLen = 50): string {
  const body = stripThinkingTags(content)
    .replace(/MEDIA:[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return body.length > maxLen ? body.slice(0, maxLen) + "…" : body;
}

export function useArtifacts(
  messages: Ref<MinimalMessage[]>,
): { groups: ComputedRef<ArtifactGroup[]> } {
  const groups = computed<ArtifactGroup[]>(() => {
    return (messages.value ?? [])
      .filter((m) => m.role === "assistant" && !m.isStreaming)
      .map((m) => {
        const artifacts = parseArtifacts(m.content || "");
        if (artifacts.length === 0) return null;
        return {
          messageId: m.id,
          messageRole: m.role,
          messagePreview: makePreview(m.content || ""),
          timestamp: m.timestamp,
          artifacts,
        } satisfies ArtifactGroup;
      })
      .filter((g): g is ArtifactGroup => g !== null);
  });

  return { groups };
}
