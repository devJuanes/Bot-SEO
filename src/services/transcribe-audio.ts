import { randomBytes } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type AsrPipeline = (
  input: string,
  options?: Record<string, unknown>,
) => Promise<{ text?: string } | string>;

let pipelinePromise: Promise<AsrPipeline> | null = null;

async function getPipeline(): Promise<AsrPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      return pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',
      ) as Promise<AsrPipeline>;
    })();
  }
  return pipelinePromise;
}

function extractText(result: { text?: string } | string): string {
  if (typeof result === 'string') return result.trim();
  return (result.text ?? '').trim();
}

export async function transcribeAudioBuffer(
  buffer: Buffer,
  ext = 'wav',
): Promise<string> {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '') || 'wav';
  const tmpPath = join(tmpdir(), `matu-voice-${randomBytes(8).toString('hex')}.${safeExt}`);
  await writeFile(tmpPath, buffer);

  try {
    const asr = await getPipeline();
    const result = await asr(tmpPath, {
      language: 'spanish',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const text = extractText(result);
    if (!text) {
      throw new Error('No se detectó voz clara en el audio');
    }
    return text;
  } finally {
    await unlink(tmpPath).catch(() => undefined);
  }
}
