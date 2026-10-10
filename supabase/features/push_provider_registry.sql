begin;
-- Apply after three_store_push_delivery.sql. Private owner registry, no server credentials.
alter table private.mm_push_devices drop constraint mm_push_devices_token_check;
alter table private.mm_push_devices add constraint mm_push_devices_token_check check(length(token) between 20 and 1536);
alter table private.mm_push_devices add column provider text not null default 'expo' check(provider in ('expo','adm'));
alter table private.mm_push_devices add column store text not null default 'play' check(store in ('ios','play','amazon'));
create function public.mm_register_push_v2(p_installation uuid,p_token text,p_provider text,p_store text) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.mm_user();subject text:=auth.jwt()->>'sub';begin
 if p_token is null then delete from private.mm_push_devices where installation=p_installation and owner_id=me;return;end if;
 if (p_provider='expo' and p_store in ('ios','play') and p_token ~ '^(ExpoPushToken|ExponentPushToken)\[[a-zA-Z0-9_-]+\]$' and length(p_token)<=256)
 or (p_provider='adm' and p_store='amazon' and length(p_token) between 20 and 1536 and p_token ~ '^[a-zA-Z0-9:._-]+$') then null;
 else raise exception 'invalid_push_provider_token';end if;
 if exists(select 1 from private.mm_push_devices where token=p_token and installation<>p_installation)then raise exception 'device_registration_conflict';end if;
 if (select count(*) from private.mm_push_devices where owner_id=me and installation<>p_installation)>=10 then raise exception 'device_limit';end if;
 -- An in-flight failure for an old token must never delete its replacement.
 if exists(select 1 from private.mm_push_devices where installation=p_installation and (token<>p_token or owner_id<>me or provider<>p_provider)) then
  update private.mm_push_jobs set lease=null,lease_until=null,ticket=null,state='queued',next_at=now()
  where installation=p_installation and state in ('queued','receipt');
 end if;
 insert into private.mm_push_devices(installation,owner_id,subject,token,provider,store)values(p_installation,me,subject,p_token,p_provider,p_store)
 on conflict(installation)do update set owner_id=excluded.owner_id,subject=excluded.subject,token=excluded.token,provider=excluded.provider,store=excluded.store,updated_at=now();
end $$;
create or replace function public.mm_claim_push_jobs() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'not_authorized';end if;
 delete from private.mm_push_jobs j using public.vc_notifications n where j.notification_id=n.id and (n.created_at<now()-interval '1 day' or n.read_at is not null);
 delete from private.mm_push_jobs j using private.mm_push_devices d where j.installation=d.installation and j.owner_id<>d.owner_id;
 with due as(select id from private.mm_push_jobs where state in ('queued','receipt') and attempts<8 and next_at<=now() and coalesce(lease_until,'-infinity')<now() order by next_at limit 50 for update skip locked),
 claimed as(update private.mm_push_jobs j set lease=gen_random_uuid(),lease_until=now()+interval '2 minutes' from due where j.id=due.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'lease',j.lease,'state',j.state,'ticket',j.ticket,'token',d.token,'provider',d.provider,'store',d.store,'notificationId',n.id,'owner',d.subject,
 'callId',n.payload->>'callId','roomId',n.payload->>'roomId')), '[]'::jsonb)into result
 from claimed j join private.mm_push_devices d on d.installation=j.installation and d.owner_id=j.owner_id join public.vc_notifications n on n.id=j.notification_id;
 return result;
end $$;
create or replace function public.mm_finish_push_job(p_job uuid,p_lease uuid,p_result text,p_ticket text default null)returns void language plpgsql security definer set search_path='' as $$
declare job private.mm_push_jobs;begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'not_authorized';end if;
 select * into job from private.mm_push_jobs where id=p_job and lease=p_lease and lease_until>now() for update;if not found then return;end if;
 if p_result='invalid' then
  delete from private.mm_push_devices where installation=job.installation and owner_id=job.owner_id;return;
 end if;
 if p_result not in ('accepted','delivered','retry','permanent','provider_accepted')then raise exception 'invalid_result';end if;
 if p_result='accepted' and (p_ticket is null or length(p_ticket)>160)then raise exception 'invalid_ticket';end if;
 update private.mm_push_jobs set state=case when p_result='accepted' then 'receipt' when p_result in ('delivered','provider_accepted') then 'done' when p_result='permanent' or attempts>=7 then 'failed' else state end,
 ticket=case when p_result='accepted' then p_ticket else ticket end,attempts=attempts+1,
 next_at=now()+case when p_result='accepted' then interval '15 minutes' else least(interval '1 hour',interval '1 minute'*power(2,least(attempts,6)))end,
 lease=null,lease_until=null where id=p_job and lease=p_lease;
end $$;

revoke all on function public.mm_register_push_v2(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.mm_register_push_v2(uuid,text,text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
