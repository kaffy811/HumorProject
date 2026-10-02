import { sameOrigin } from "@/lib/humor-validation";
import { createClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:"Invalid origin"},{status:403});
  const db = await createClient();
  const {data:{user}} = await db.auth.getUser();
  if (!user) return Response.json({error:"Sign in to vote."},{status:401});
  const body = await request.json().catch(()=>null);
  if (!body || !/^[0-9a-f-]{36}$/i.test(body.captionId) || ![1,-1].includes(body.value)) return Response.json({error:"Invalid vote."},{status:400});
  const {error} = await db.from("humor_votes").insert({user_id:user.id,caption_id:body.captionId,value:body.value});
  if(error) return Response.json({error:error.code==="23505"?"You already rated this caption.":"Unable to save vote."},{status:error.code==="23505"?409:400});
  return Response.json({ok:true});
}
