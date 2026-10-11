import { notFound } from "next/navigation";
import { requireMember } from "@/lib/profile";
import { isMaintainer } from "@/lib/maintenance";
import { PreviewBackfill } from "@/components/detail/PreviewBackfill";
export default async function Page() {
  const { user } = await requireMember();
  if (!isMaintainer(user.id)) notFound();
  return <PreviewBackfill />;
}
