begin;
-- Allow deliberate regeneration immediately after completion, while keeping daily quotas.
create or replace function public.reserve_humor_generation(image_id uuid,owner uuid,request_key uuid,provider_name text,model_name text,system_text text,user_text text,settings jsonb,joke_style text,extra_context text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; draft public.humor_drafts;
begin
 perform pg_advisory_xact_lock(6909261009);
 select g.id into result from public.humor_generations g where g.user_id=owner and g.request_key=reserve_humor_generation.request_key and g.image_id=reserve_humor_generation.image_id;
 if found then return result; end if;
 select * into draft from public.humor_drafts d where d.image_id=reserve_humor_generation.image_id and d.user_id=owner and d.upload_status='ready' and d.caption_id is null;
 if not found then raise exception 'Missing ready draft'; end if;
 if provider_name='google' and exists(select 1 from public.humor_generations g where g.user_id=owner and g.provider='google' and g.status='processing' and g.created_at>now()-interval '2 minutes')
 then raise exception 'Generation busy'; end if;
 if provider_name='google' and (
  (select count(*) from public.humor_generations g where g.user_id=owner and g.provider='google' and g.created_at>now()-interval '1 day')>=10
  or (select count(*) from public.humor_generations g where g.provider='google' and g.created_at>now()-interval '1 day')>=100)
 then raise exception 'Generation limit'; end if;
 insert into public.humor_generations(image_id,user_id,provider,model,system_prompt,user_prompt,generation_config,image_path,image_mime,image_sha256,prompt_version,request_key,joke_style,extra_context)
 values(draft.image_id,owner,provider_name,model_name,system_text,user_text,settings,draft.ai_path,'image/png',draft.image_sha256,'creation-v2',reserve_humor_generation.request_key,reserve_humor_generation.joke_style,reserve_humor_generation.extra_context)
 returning id into result;
 return result;
end $$;
commit;
