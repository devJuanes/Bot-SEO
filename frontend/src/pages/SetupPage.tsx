import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, PenLine, Sparkles } from 'lucide-react';
import { projectApi } from '../api/client';
import { Button } from '../components/ui/Button';
import { Field, Input, Textarea } from '../components/ui/Input';
import { useSetup } from '../hooks/useSetup';
import { cn } from '../lib/cn';

type Mode = 'choose' | 'manual' | 'auto' | 'done';

export function SetupPage() {
  const navigate = useNavigate();
  const { status, refresh } = useSetup();
  const [mode, setMode] = useState<Mode>('choose');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);

  async function submitManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const res = await projectApi('/setup/brand/manual', {
        method: 'POST',
        body: JSON.stringify({
          brand_name: form.get('brand_name'),
          description: form.get('description'),
          country: form.get('country'),
          phone: form.get('phone'),
          website: form.get('website') || undefined,
          socials: {
            facebook: String(form.get('facebook') || '') || undefined,
            instagram: String(form.get('instagram') || '') || undefined,
            linkedin: String(form.get('linkedin') || '') || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setSummary(data.profile);
      setMode('done');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitAuto(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const res = await projectApi('/setup/brand/auto', {
        method: 'POST',
        body: JSON.stringify({
          websiteUrl: form.get('websiteUrl'),
          googleMapsUrl: form.get('googleMapsUrl') || undefined,
          socials: {
            facebook: String(form.get('facebook') || '') || undefined,
            instagram: String(form.get('instagram') || '') || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setSummary(data.profile);
      setMode('done');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (status?.brandConfigured && mode === 'choose') {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="soft-card max-w-md p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-brand-600" />
          <h1 className="mt-4 text-xl font-bold">Marca ya configurada</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Puedes editarla en Ajustes → Marca o continuar al dashboard.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/settings/brand')}>
              Editar marca
            </Button>
            <Button onClick={() => navigate('/dashboard')}>Ir al dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-md shadow-brand-600/30">
          M
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Configura tu marca</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sin marca no podrás activar agentes ni lanzar cazas. Elige cómo empezar.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{error}</p>
      )}

      {mode === 'choose' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={cn(
              'soft-card p-6 text-left transition hover:ring-2 hover:ring-brand-200',
            )}
          >
            <PenLine className="h-7 w-7 text-brand-600" />
            <h2 className="mt-4 text-lg font-semibold">Manual</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Nombre, descripción, país, teléfono y redes opcionales.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode('auto')}
            className="soft-card p-6 text-left transition hover:ring-2 hover:ring-brand-200"
          >
            <Globe className="h-7 w-7 text-brand-600" />
            <h2 className="mt-4 text-lg font-semibold">Automático</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Pegamos tu web (y Maps opcional) y extraemos el conocimiento de marca.
            </p>
          </button>
        </div>
      )}

      {mode === 'manual' && (
        <form onSubmit={submitManual} className="soft-card space-y-4 p-6">
          <Field>
            <label className="mb-1 block text-sm font-medium">Nombre de marca *</label>
            <Input name="brand_name" required />
          </Field>
          <Field>
            <label className="mb-1 block text-sm font-medium">Descripción *</label>
            <Textarea name="description" required rows={4} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <label className="mb-1 block text-sm font-medium">País</label>
              <Input name="country" placeholder="Colombia" />
            </Field>
            <Field>
              <label className="mb-1 block text-sm font-medium">Teléfono</label>
              <Input name="phone" placeholder="57…" />
            </Field>
          </div>
          <Field>
            <label className="mb-1 block text-sm font-medium">Sitio web</label>
            <Input name="website" type="url" placeholder="https://" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <label className="mb-1 block text-sm font-medium">Facebook</label>
              <Input name="facebook" />
            </Field>
            <Field>
              <label className="mb-1 block text-sm font-medium">Instagram</label>
              <Input name="instagram" />
            </Field>
            <Field>
              <label className="mb-1 block text-sm font-medium">LinkedIn</label>
              <Input name="linkedin" />
            </Field>
          </div>
          <div className="flex justify-between pt-2">
            <Button type="button" variant="secondary" onClick={() => setMode('choose')}>
              Atrás
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar marca'}
            </Button>
          </div>
        </form>
      )}

      {mode === 'auto' && (
        <form onSubmit={submitAuto} className="soft-card space-y-4 p-6">
          <Field>
            <label className="mb-1 block text-sm font-medium">URL del sitio web *</label>
            <Input name="websiteUrl" type="url" required placeholder="https://tuempresa.com" />
          </Field>
          <Field>
            <label className="mb-1 block text-sm font-medium">Google Maps (opcional)</label>
            <Input name="googleMapsUrl" type="url" placeholder="https://maps.google.com/…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <label className="mb-1 block text-sm font-medium">Facebook</label>
              <Input name="facebook" />
            </Field>
            <Field>
              <label className="mb-1 block text-sm font-medium">Instagram</label>
              <Input name="instagram" />
            </Field>
          </div>
          <div className="flex justify-between pt-2">
            <Button type="button" variant="secondary" onClick={() => setMode('choose')}>
              Atrás
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Extrayendo…' : 'Detectar marca'}
            </Button>
          </div>
        </form>
      )}

      {mode === 'done' && summary && (
        <div className="soft-card space-y-4 p-6">
          <h2 className="text-lg font-semibold">Marca lista</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-ink-muted">Nombre</dt>
              <dd className="font-medium">{String(summary.brand_name)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Descripción</dt>
              <dd>{String(summary.description)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Conocimiento (extracto)</dt>
              <dd className="whitespace-pre-wrap text-ink-muted">
                {String(summary.knowledge || '').slice(0, 500)}
              </dd>
            </div>
          </dl>
          <Button onClick={() => navigate('/dashboard')}>Ir al dashboard</Button>
        </div>
      )}
    </div>
  );
}
