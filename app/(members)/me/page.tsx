import { requireMember } from "@/lib/profile";
import { ProfilePage } from "@/components/profile/ProfilePage";
export default async function MePage() {
  const { user } = await requireMember();
  return <ProfilePage id={user!.id} />;
}
