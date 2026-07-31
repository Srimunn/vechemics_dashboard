'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS, SETTINGS_ITEM } from '@/lib/nav';

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const renderItem = (href: string, title: string, Icon: (typeof NAV_SECTIONS)[0]['items'][0]['icon']) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          active
            ? 'border-l-2 border-primary bg-accent text-primary'
            : 'border-l-2 border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{title}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Company header */}
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">VChemics</p>
          <p className="truncate text-xs text-muted-foreground">CEO Dashboard</p>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.label}
            </p>
            {section.items.map((i) => renderItem(i.href, i.title, i.icon))}
          </div>
        ))}
      </nav>

      {/* Settings + sync footer */}
      <div className="border-t px-3 py-3">
        {renderItem(SETTINGS_ITEM.href, SETTINGS_ITEM.title, SETTINGS_ITEM.icon)}
        <p className="px-3 pt-3 text-[10px] leading-relaxed text-muted-foreground/70">
          Tally sync • TallyPrime Release 7.0 • XML API
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">
      <SidebarContent />
    </aside>
  );
}
