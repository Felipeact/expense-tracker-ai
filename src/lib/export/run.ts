import { resolveFilename, suggestFilename } from "./filename";
import { EXPORT_FORMATS } from "./formats";
import type { ExportOptions, ExportSelection } from "./types";

export type ExportStage = "preparing" | "generating" | "saving";

export interface ExportProgress {
  stage: ExportStage;
  /** Overall progress, 0..1. */
  ratio: number;
}

export interface ExportResult {
  filename: string;
  size: number;
  count: number;
}

export class ExportCancelledError extends Error {
  constructor() {
    super("Export cancelled");
  }
}

// Short exports would otherwise flash the progress UI for a single frame.
const MIN_DURATION_MS = 600;

const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on a later tick: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Runs an export end to end: builds the file off the main paint loop, reports progress, then downloads it. */
export async function runExport(
  options: ExportOptions,
  selection: ExportSelection,
  {
    signal,
    onProgress,
    save = downloadBlob,
  }: { signal?: AbortSignal; onProgress?: (progress: ExportProgress) => void; save?: typeof downloadBlob } = {},
): Promise<ExportResult> {
  const startedAt = Date.now();
  const format = EXPORT_FORMATS[options.format];
  const report = (stage: ExportStage, ratio: number) => onProgress?.({ stage, ratio });
  const checkpoint = async () => {
    await nextFrame();
    if (signal?.aborted) throw new ExportCancelledError();
  };

  report("preparing", 0.05);
  await checkpoint();

  const blob = await format.build({
    options,
    selection,
    generatedAt: new Date(),
    onProgress: (ratio) => report("generating", 0.1 + ratio * 0.8),
    checkpoint,
  });

  report("saving", 0.95);
  const remaining = MIN_DURATION_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  if (signal?.aborted) throw new ExportCancelledError();

  const filename = resolveFilename(options.filename, format.extension, suggestFilename(options));
  save(blob, filename);
  report("saving", 1);
  return { filename, size: blob.size, count: selection.rows.length };
}
