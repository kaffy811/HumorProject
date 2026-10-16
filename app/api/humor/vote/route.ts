import { sameOrigin } from "@/lib/humor-validation";
import { profileComplete } from "@/lib/profile";
import { memberAuth } from "@/lib/member-auth";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:"Invalid origin"},{status:403});
  const { db, user } = await memberAuth();
  if (!user) return Response.json({error:"Sign in to vote."},{status:401});
  const { data: profile, error: profileError } = await db.from('profiles').select('username,avatar_path').eq('id', user.id).maybeSingle();
  if (profileError) return Response.json({error:'Unable to load your profile.'},{status:503});
  if (!profileComplete(profile)) return Response.json({error:'Complete your Profile before voting.'},{status:403});
  const body = await request.json().catch(()=>null);
  if (!body || !/^[0-9a-f-]{36}$/i.test(body.captionId) || ![1,-1].includes(body.value)) return Response.json({error:"Invalid vote."},{status:400});
  const {error} = await db.from("humor_votes").insert({user_id:user.id,caption_id:body.captionId,value:body.value});
  if(error?.code==="23505"){const {data:existing}=await db.from("humor_votes").select("value").eq("user_id",user.id).eq("caption_id",body.captionId).maybeSingle();return Response.json({error:"You already rated this caption.",vote:existing?.value},{status:409});}
  if(error) return Response.json({error:error.code==="23505"?"You already rated this caption.":"Unable to save vote."},{status:error.code==="23505"?409:400});
  return Response.json({ok:true});
}
