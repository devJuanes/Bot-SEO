import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Send } from 'lucide-react';
import { PageMeta } from '../../components/seo/PageMeta';
import { submitContact } from '../../api/contact';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';

export function ContactPage() {
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
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
      await submitContact({
        name,
        email,
        company: company || undefined,
        phone: phone || undefined,
        message,
        sourcePage: location.pathname,
      });
      setSuccess(true);
      setName('');
      setEmail('');
      setCompany('');
      setPhone('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageMeta
        title="Contacto"
        description="Contacta al equipo de MatuByte Growth Factory. Solicita demo, plan a medida o soporte comercial para tu equipo de growth."
        path="/contacto"
      />

      <section className="border-b border-border-soft bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Contacto</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Hablemos de tu growth
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink-muted">
            Cuéntanos sobre tu negocio, volumen de leads o integraciones que necesitas. Respondemos
            en horario laboral (COT).
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-xl px-5 py-16">
        <form
          className="space-y-5 rounded-3xl border border-border-soft bg-white p-6 shadow-sm sm:p-8"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <div>
            <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium text-ink">
              Nombre *
            </label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoComplete="name"
            />
          </div>

          <div>
            <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-ink">
              Email *
            </label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-company" className="mb-1.5 block text-sm font-medium text-ink">
                Empresa
              </label>
              <Input
                id="contact-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoComplete="organization"
              />
            </div>
            <div>
              <label htmlFor="contact-phone" className="mb-1.5 block text-sm font-medium text-ink">
                Teléfono
              </label>
              <Input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
          </div>

          <div>
            <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-ink">
              Mensaje *
            </label>
            <Textarea
              id="contact-message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={10}
              placeholder="Cuéntanos qué quieres lograr con Growth Factory…"
            />
          </div>

          {error ? (
            <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800" role="status">
              Mensaje enviado. Te contactaremos pronto.
            </p>
          ) : null}

          <Button type="submit" loading={sending} className="w-full sm:w-auto">
            <Send className="h-4 w-4" />
            Enviar mensaje
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-muted">
          ¿Ya tienes cuenta?{' '}
          <a href="mailto:soporte@matubyte.com" className="text-brand-600 hover:underline">
            soporte@matubyte.com
          </a>{' '}
          o el centro de ayuda dentro del cockpit.
        </p>
      </section>
    </>
  );
}
