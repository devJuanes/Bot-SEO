import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { FAQ_CATEGORIES, HELP_FAQ } from '../../data/help-faq';
import { cn } from '../../lib/cn';

export function HelpFaqPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(HELP_FAQ[0]?.id ?? null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return HELP_FAQ.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!needle) return true;
      return (
        item.question.toLowerCase().includes(needle) ||
        item.answer.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle)
      );
    });
  }, [search, category]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            className="pl-11"
            placeholder="Buscar en preguntas frecuentes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCategory('all')}>
          <Badge tone={category === 'all' ? 'brand' : 'default'}>Todas</Badge>
        </button>
        {FAQ_CATEGORIES.map((cat) => (
          <button key={cat} type="button" onClick={() => setCategory(cat)}>
            <Badge tone={category === cat ? 'brand' : 'default'}>{cat}</Badge>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardBody className="py-10 text-center text-sm text-ink-muted">
              No hay resultados para tu búsqueda.
            </CardBody>
          </Card>
        ) : (
          filtered.map((item) => {
            const open = openId === item.id;
            return (
              <Card key={item.id} className="overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left"
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <div className="min-w-0 flex-1">
                    <Badge tone="info" className="mb-2">
                      {item.category}
                    </Badge>
                    <h3 className="text-sm font-semibold text-ink">{item.question}</h3>
                  </div>
                  <ChevronDown
                    className={cn(
                      'mt-1 h-4 w-4 shrink-0 text-ink-muted transition',
                      open && 'rotate-180',
                    )}
                  />
                </button>
                {open ? (
                  <div className="border-t border-border-soft px-5 pb-4 pt-2">
                    <p className="text-sm leading-relaxed text-ink-muted">{item.answer}</p>
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
