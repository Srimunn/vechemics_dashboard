import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { BottomTabBar } from '@/components/layout/BottomTabBar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  let userName = session?.user?.name ?? 'Velmurugan';
  if (userName === 'Ravi Venkatesan' || userName === 'Ravi') {
    userName = 'Velmurugan';
  }
  const userRole = session?.user?.role ?? 'CEO / MD';

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar userName={userName} userRole={userRole} />
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] pb-[88px] lg:pb-0">{children}</main>
        <BottomTabBar />
      </div>
    </div>
  );
}
