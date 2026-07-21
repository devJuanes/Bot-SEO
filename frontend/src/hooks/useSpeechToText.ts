import { useCallback, useEffect, useRef, useState } from 'react';
import { projectApi } from '../api/client';
import { decodeAudioBlob, float32ToWav } from '../lib/audio';

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return 'audio/webm';
}

export function useSpeechToText(options?: {
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const supported =
    typeof window !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onFinalRef = useRef(options?.onFinal);
  const onErrorRef = useRef(options?.onError);

  useEffect(() => {
    onFinalRef.current = options?.onFinal;
    onErrorRef.current = options?.onError;
  }, [options?.onFinal, options?.onError]);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const transcribeBlob = useCallback(async (blob: Blob) => {
    if (blob.size < 800) {
      onErrorRef.current?.('Grabación muy corta. Mantén el micrófono un poco más.');
      return;
    }

    setTranscribing(true);
    try {
      const samples = await decodeAudioBlob(blob);
      const wav = float32ToWav(samples, 16_000);
      const form = new FormData();
      form.append('audio', wav, 'voice.wav');

      const res = await projectApi('/company-chat/transcribe', {
        method: 'POST',
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo transcribir el audio');
      }

      const text = String(data.text ?? '').trim();
      if (text) {
        onFinalRef.current?.(text);
      } else {
        onErrorRef.current?.(
          'No se entendió el audio. Habla más cerca del micrófono e intenta de nuevo.',
        );
      }
    } catch (error) {
      onErrorRef.current?.(
        error instanceof Error
          ? error.message
          : 'No se pudo transcribir el audio. Intenta de nuevo.',
      );
    } finally {
      setTranscribing(false);
    }
  }, []);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setListening(false);
      return;
    }

    setListening(false);

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || pickMimeType();
        resolve(new Blob(chunksRef.current, { type }));
        cleanupStream();
      };
      recorder.stop();
    });

    await transcribeBlob(blob);
  }, [cleanupStream, transcribeBlob]);

  const start = useCallback(async () => {
    if (!supported) {
      onErrorRef.current?.('Tu navegador no soporta grabación de voz.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setListening(false);
        cleanupStream();
        onErrorRef.current?.('Error al grabar audio. Intenta de nuevo.');
      };

      recorder.start(250);
      recorderRef.current = recorder;
      setListening(true);
    } catch {
      cleanupStream();
      onErrorRef.current?.('Permite el acceso al micrófono en tu navegador y vuelve a intentar.');
    }
  }, [cleanupStream, supported]);

  const toggle = useCallback(() => {
    if (transcribing) return;
    if (listening) void stop();
    else void start();
  }, [listening, start, stop, transcribing]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanupStream();
    };
  }, [cleanupStream]);

  return {
    listening,
    transcribing,
    preparing: transcribing,
    supported,
    start,
    stop,
    toggle,
  };
}
