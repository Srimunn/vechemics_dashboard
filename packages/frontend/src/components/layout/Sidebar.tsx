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
          'flex items-center rounded-lg px-4 py-[10px] text-[14px] font-medium transition-colors',
          active
            ? 'bg-[#EFF6FF] text-[#1D4ED8] font-semibold border-l-[3px] border-[#1D4ED8]'
            : 'text-[#475569] hover:bg-[#F1F5F9]',
        )}
      >
        <Icon className={cn('mr-3 h-[18px] w-[18px] shrink-0', active ? 'text-[#1D4ED8]' : 'text-[#475569]')} />
        <span className="truncate">{title}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[#FFFFFF] text-[#475569]">
      {/* Company header */}
      <div className="flex items-center gap-3 bg-[#1E3A5F] px-4 py-5 text-white">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-snug text-white">VChemics India Solutions</p>
          <p className="truncate text-xs font-normal text-white/70">CEO Dashboard</p>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mt-6 mb-2 first:mt-2">
            <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
              {section.label}
            </p>
            <div className="mt-2 space-y-1">
              {section.items.map((i) => renderItem(i.href, i.title, i.icon))}
            </div>
          </div>
        ))}
      </nav>

      {/* Settings + sync footer */}
      <div className="border-t border-[#E2E8F0] px-2 py-3">
        {renderItem(SETTINGS_ITEM.href, SETTINGS_ITEM.title, SETTINGS_ITEM.icon)}
        <div className="flex items-center px-4 pt-3 text-[11px] text-[#94A3B8]">
          <span className="mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <span className="truncate">Tally sync • TallyPrime Release 7.0 • XML API</span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[#E2E8F0] bg-[#FFFFFF] lg:block">
      <SidebarContent />
    </aside>
  );
}
