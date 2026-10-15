begin;
alter table public.humor_captions drop constraint humor_captions_source_check;
alter table public.humor_captions add constraint humor_captions_source_check check(source in('ai','seed','handmade'));
create table public.humor_moderation_checks(user_id uuid not null references auth.users(id)on delete cascade,image_id uuid not null references public.humor_images(id)on delete cascade,content_hash text not null,model text not null,allowed boolean not null,created_at timestamptz not null default now(),primary key(user_id,image_id,content_hash));
alter table public.humor_moderation_checks enable row level security;
revoke all on public.humor_moderation_checks from public,anon,authenticated;
grant all on public.humor_moderation_checks to service_role;
create function public.publish_humor_handmade(image_id uuid,owner uuid,final_text text,publication_key uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare draft public.humor_drafts;result uuid;first_post boolean;
begin
 perform 1 from public.profiles p where p.id=owner for update;
 select * into draft from public.humor_drafts d where d.image_id=publish_humor_handmade.image_id and d.user_id=owner for update;
 if not found then raise exception 'Missing draft';end if;
 if draft.caption_id is not null then return jsonb_build_object('postId',draft.caption_id,'isFirstPost',false);end if;
 if draft.upload_status<>'ready' or char_length(trim(final_text))not between 1 and 200 then raise exception 'Invalid publication';end if;
 if not exists(select 1 from public.humor_moderation_checks m where m.user_id=owner and m.image_id=draft.image_id and m.content_hash=encode(sha256(convert_to(trim(final_text),'UTF8')),'hex')and m.allowed and m.created_at>now()-interval '1 day')then raise exception 'Safety approval required';end if;
 if not exists(select 1 from public.humor_images i where i.id=draft.image_id and i.locked_thumbnail_path is not null)then raise exception 'Locked thumbnail required';end if;
 select not exists(select 1 from public.humor_captions c join public.humor_images i on i.id=c.image_id where i.user_id=owner)into first_post;
 insert into public.humor_captions(image_id,content,style,source)values(draft.image_id,trim(final_text),'HANDMADE','handmade')returning id into result;
 update public.humor_drafts set caption_id=result,publish_key=publication_key,published_at=now()where humor_drafts.image_id=draft.image_id;
 update public.humor_images set status='ready'where id=draft.image_id;
 update public.profiles set onboarded_at=coalesce(onboarded_at,now()),first_post_notice_id=case when first_post then result else first_post_notice_id end where id=owner;
 return jsonb_build_object('postId',result,'isFirstPost',first_post);
end $$;
revoke all on function public.publish_humor_handmade(uuid,uuid,text,uuid)from public,anon,authenticated;
grant execute on function public.publish_humor_handmade(uuid,uuid,text,uuid)to service_role;
-- Photos remain optional for direct authenticated mutations as well as server routes.
drop policy "Completed profile required to vote"on public.humor_votes;
create policy "Completed profile required to vote"on public.humor_votes as restrictive for insert to authenticated with check(exists(select 1 from public.profiles p where p.id=(select auth.uid())and length(trim(p.first_name))>0 and length(trim(p.last_name))>0 and p.username is not null));
create or replace function public.publish_humor_draft(image_id uuid,owner uuid,generation_id uuid,candidate_id uuid,final_text text,publication_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare draft public.humor_drafts; generation public.humor_generations; result uuid;
begin
 select * into draft from public.humor_drafts d where d.image_id=publish_humor_draft.image_id and d.user_id=owner for update;
 if not found then raise exception 'Missing draft'; end if;
 if draft.caption_id is not null then return draft.caption_id; end if;
 if draft.upload_status<>'ready' or char_length(trim(final_text)) not between 1 and 200 then raise exception 'Invalid publication'; end if;
 select * into generation from public.humor_generations g where g.id=generation_id and g.image_id=draft.image_id and g.user_id=owner and g.status='completed' and g.provider='google';
 if not found or not exists(select 1 from jsonb_array_elements(generation.caption_candidates) c where c->>'id'=candidate_id::text) then raise exception 'Invalid candidate'; end if;
 insert into public.humor_captions(image_id,content,style) values(draft.image_id,trim(final_text),coalesce((select c->>'style' from jsonb_array_elements(generation.caption_candidates)c where c->>'id'=candidate_id::text),generation.joke_style,'Deadpan')) returning id into result;
 update public.humor_images i set status='ready',storage_path=draft.image_path,description=generation.scene where i.id=draft.image_id and i.user_id=owner;
 update public.humor_drafts d set caption_id=result,publish_key=publication_key,published_at=now() where d.image_id=draft.image_id;
 return result;
end $$;
commit;
