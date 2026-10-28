begin;

-- Admin model routing: the member app now generates captions with the model
-- and prompt chosen in the Humor Admin console (prompt-chain mix → step 1 →
-- LLM model → provider), not only the built-in Gemini prompt.

-- Any provider slug from humor_llm_providers, not just google and mock.
alter table public.humor_generations drop constraint humor_generations_provider_check;
alter table public.humor_generations add constraint humor_generations_provider_check
  check (provider ~ '^[a-z0-9][a-z0-9-]{1,39}$');

-- Reservation records which prompt version (chain) the run used. Limits now
-- count every real provider, so switching models cannot bypass them.
create function public.reserve_humor_generation(image_id uuid, owner uuid, request_key uuid, provider_name text, model_name text, system_text text, user_text text, settings jsonb, joke_style text, extra_context text, prompt_version_name text)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare result uuid; draft public.humor_drafts;
begin
 perform pg_advisory_xact_lock(6909261009);
 select g.id into result from public.humor_generations g where g.user_id=owner and g.request_key=reserve_humor_generation.request_key and g.image_id=reserve_humor_generation.image_id;
 if found then return result; end if;
 select * into draft from public.humor_drafts d where d.image_id=reserve_humor_generation.image_id and d.user_id=owner and d.upload_status='ready' and d.caption_id is null;
 if not found then raise exception 'Missing ready draft'; end if;
 if provider_name<>'mock' and exists(select 1 from public.humor_generations g where g.user_id=owner and g.provider<>'mock' and g.status='processing' and g.created_at>now()-interval '2 minutes')
 then raise exception 'Generation busy'; end if;
 if provider_name<>'mock' and (
  (select count(*) from public.humor_generations g where g.user_id=owner and g.provider<>'mock' and g.created_at>now()-interval '1 day')>=10
  or (select count(*) from public.humor_generations g where g.provider<>'mock' and g.created_at>now()-interval '1 day')>=100)
 then raise exception 'Generation limit'; end if;
 insert into public.humor_generations(image_id,user_id,provider,model,system_prompt,user_prompt,generation_config,image_path,image_mime,image_sha256,prompt_version,request_key,joke_style,extra_context)
 values(draft.image_id,owner,provider_name,model_name,system_text,user_text,settings,draft.ai_path,'image/png',draft.image_sha256,coalesce(nullif(trim(prompt_version_name),''),'caption-styles-v3'),reserve_humor_generation.request_key,reserve_humor_generation.joke_style,reserve_humor_generation.extra_context)
 returning id into result;
 return result;
end $function$;
revoke all on function public.reserve_humor_generation(uuid,uuid,uuid,text,text,text,text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_humor_generation(uuid,uuid,uuid,text,text,text,text,jsonb,text,text,text) to service_role;

-- The previous signature (still called by already-deployed code) keeps working.
create or replace function public.reserve_humor_generation(image_id uuid, owner uuid, request_key uuid, provider_name text, model_name text, system_text text, user_text text, settings jsonb, joke_style text, extra_context text)
returns uuid language sql security definer set search_path to '' as $function$
  select public.reserve_humor_generation(image_id, owner, request_key, provider_name, model_name, system_text, user_text, settings, joke_style, extra_context, 'caption-styles-v3')
$function$;

-- Captions from any real provider can be published (was google only).
create or replace function public.publish_humor_draft(image_id uuid,owner uuid,generation_id uuid,candidate_id uuid,final_text text,publication_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare draft public.humor_drafts; generation public.humor_generations; result uuid;
begin
 select * into draft from public.humor_drafts d where d.image_id=publish_humor_draft.image_id and d.user_id=owner for update;
 if not found then raise exception 'Missing draft'; end if;
 if draft.caption_id is not null then return draft.caption_id; end if;
 if draft.upload_status<>'ready' or char_length(trim(final_text)) not between 1 and 200 then raise exception 'Invalid publication'; end if;
 select * into generation from public.humor_generations g where g.id=generation_id and g.image_id=draft.image_id and g.user_id=owner and g.status='completed' and g.provider<>'mock';
 if not found or not exists(select 1 from jsonb_array_elements(generation.caption_candidates) c where c->>'id'=candidate_id::text) then raise exception 'Invalid candidate'; end if;
 if not exists(select 1 from public.humor_moderation_checks m where m.user_id=owner and m.image_id=draft.image_id and m.content_hash=encode(sha256(convert_to(trim(final_text),'UTF8')),'hex')and m.allowed and m.created_at>now()-interval '1 day')then raise exception 'Safety approval required';end if;
 insert into public.humor_captions(image_id,content,style) values(draft.image_id,trim(final_text),coalesce((select c->>'style' from jsonb_array_elements(generation.caption_candidates)c where c->>'id'=candidate_id::text),generation.joke_style,'Deadpan')) returning id into result;
 update public.humor_images i set status='ready',storage_path=draft.image_path,description=generation.scene where i.id=draft.image_id and i.user_id=owner;
 update public.humor_drafts d set caption_id=result,publish_key=publication_key,published_at=now() where d.image_id=draft.image_id;
 return result;
end $$;

commit;
