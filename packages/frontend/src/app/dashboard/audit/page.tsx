import { ComingSoonPage } from "@/components/layout/ComingSoonPage";
import { findNavItem } from "@/lib/nav";

export default function Page() {
  const item = findNavItem("/dashboard/audit");
  return (
    <ComingSoonPage
      title={item?.title ?? "Module"}
      plannedFor={item?.phase ?? "Phase 2"}
      description={item?.description}
      icon={item?.icon}
    />
  );
}
