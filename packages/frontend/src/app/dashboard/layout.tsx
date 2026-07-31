import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userName = session?.user?.name ?? 'Velmurugan';
  const userRole = session?.user?.role ?? 'CEO / MD';

  return (
    <div className="flex h-screen overflow-hidden bg-muted/40">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar userName={userName} userRole={userRole} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
