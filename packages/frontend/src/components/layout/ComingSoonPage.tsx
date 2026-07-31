import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ComingSoonPage({
  title,
  plannedFor = 'Phase 2',
  description,
  icon: Icon,
  features,
}: {
  title: string;
  plannedFor?: string;
  description?: string;
  icon?: LucideIcon;
  features?: string[];
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
          {Icon ? <Icon className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}
        </div>
        <div className="mt-5 flex items-center justify-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        <div className="mt-2 flex justify-center">
          <Badge tone="primary">Coming in {plannedFor}</Badge>
        </div>
        {description && (
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {features && features.length > 0 && (
          <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {f}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-8 text-xs text-muted-foreground/70">
          This module is on the roadmap. The CEO Dashboard is fully live today.
        </p>
      </div>
    </div>
  );
}
