import { redirect } from "next/navigation";
import { requireMember } from "@/lib/profile";
import { ProfilePage } from "@/components/profile/ProfilePage";
export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireMember();
  const { id } = await params;
  if (id === user!.id) redirect("/me");
  return <ProfilePage id={id} />;
}
