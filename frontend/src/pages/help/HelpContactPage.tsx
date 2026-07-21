import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { apiJson } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';

const CATEGORIES = [
  { value: 'general', label: 'Consulta general' },
  { value: 'technical', label: 'Problema técnico' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'billing', label: 'Facturación / plan' },
  { value: 'feature', label: 'Sugerencia de función' },
];

export function HelpContactPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');
    setSuccess(false);
    try {
      await apiJson('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ category, subject, message }),
      });
      setSuccess(true);
      setSubject('');
      setMessage('');
      setTimeout(() => navigate('/help/tickets'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el ticket');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card>
        <CardBody>
          <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Categoría</label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Asunto</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: No puedo conectar WhatsApp"
                required
                minLength={3}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Mensaje</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe tu problema o consulta con el mayor detalle posible…"
                rows={6}
                required
                minLength={10}
              />
            </div>

            {error ? (
              <p className="rounded-xl bg-brand-50 px-4 py-2 text-sm text-brand-700">{error}</p>
            ) : null}
            {success ? (
              <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                Ticket creado. Redirigiendo a Mis tickets…
              </p>
            ) : null}

            <Button type="submit" loading={sending} className="w-full sm:w-auto">
              <Send className="h-4 w-4" />
              Enviar ticket
            </Button>
          </form>
        </CardBody>
      </Card>

      <p className="text-center text-xs text-ink-muted">
        También puedes escribir a{' '}
        <a href="mailto:soporte@matubyte.com" className="text-brand-600 hover:underline">
          soporte@matubyte.com
        </a>
      </p>
    </div>
  );
}
