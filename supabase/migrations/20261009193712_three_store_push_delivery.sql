begin;
-- Additive rollout: device tokens and delivery leases remain outside exposed schemas.
create table private.mm_push_devices(
 installation uuid primary key,owner_id uuid not null references public.vc_profiles(id) on delete cascade,
 subject text not null,token text unique not null check(length(token) between 20 and 256),
 updated_at timestamptz not null default now()
);
create index mm_push_devices_owner on private.mm_push_devices(owner_id);
alter table private.mm_push_devices enable row level security;
revoke all on private.mm_push_devices from public,anon,authenticated;
create table private.mm_push_jobs(
 id uuid primary key default gen_random_uuid(),notification_id uuid not null references public.vc_notifications(id) on delete cascade,
 installation uuid not null references private.mm_push_devices(installation) on delete cascade,owner_id uuid not null,
 state text not null default 'queued' check(state in ('queued','receipt','done','failed')),ticket text,
 attempts int not null default 0,next_at timestamptz not null default now(),lease uuid,lease_until timestamptz,
 unique(notification_id,installation)
);
create index mm_push_jobs_due on private.mm_push_jobs(next_at) where state in ('queued','receipt');
alter table private.mm_push_jobs enable row level security;
revoke all on private.mm_push_jobs from public,anon,authenticated;
create function public.mm_register_push(p_installation uuid,p_token text) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=private.mm_user();subject text:=auth.jwt()->>'sub';begin
 if p_token is null then delete from private.mm_push_devices where installation=p_installation and owner_id=me;return;end if;
 if p_token !~ '^(ExpoPushToken|ExponentPushToken)\[[a-zA-Z0-9_-]+\]$' or length(p_token)>256 then raise exception 'invalid_push_token';end if;
 if exists(select 1 from private.mm_push_devices where token=p_token and installation<>p_installation)then raise exception 'device_registration_conflict';end if;
 if (select count(*) from private.mm_push_devices where owner_id=me and installation<>p_installation)>=10 then raise exception 'device_limit';end if;
 insert into private.mm_push_devices(installation,owner_id,subject,token)values(p_installation,me,subject,p_token)
 on conflict(installation)do update set owner_id=excluded.owner_id,subject=excluded.subject,token=excluded.token,updated_at=now();
end $$;
create function private.mm_enqueue_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.mm_push_jobs(notification_id,installation,owner_id)
 select new.id,d.installation,new.user_id from private.mm_push_devices d where d.owner_id=new.user_id and d.updated_at>now()-interval '30 days';
 return new;
end $$;
create trigger mm_enqueue_push after insert on public.vc_notifications for each row execute function private.mm_enqueue_push();
create function public.mm_claim_push_jobs() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'not_authorized';end if;
 delete from private.mm_push_jobs j using public.vc_notifications n where j.notification_id=n.id and (n.created_at<now()-interval '1 day' or n.read_at is not null);
 delete from private.mm_push_jobs j using private.mm_push_devices d where j.installation=d.installation and j.owner_id<>d.owner_id;
 with due as(select id from private.mm_push_jobs where state in ('queued','receipt') and attempts<8 and next_at<=now() and coalesce(lease_until,'-infinity')<now() order by next_at limit 50 for update skip locked),
 claimed as(update private.mm_push_jobs j set lease=gen_random_uuid(),lease_until=now()+interval '2 minutes' from due where j.id=due.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'lease',j.lease,'state',j.state,'ticket',j.ticket,'token',d.token,'notificationId',n.id,'owner',d.subject,
 'callId',n.payload->>'callId','roomId',n.payload->>'roomId')), '[]'::jsonb)into result
 from claimed j join private.mm_push_devices d on d.installation=j.installation and d.owner_id=j.owner_id join public.vc_notifications n on n.id=j.notification_id;
 return result;
end $$;
create function public.mm_finish_push_job(p_job uuid,p_lease uuid,p_result text,p_ticket text default null)returns void language plpgsql security definer set search_path='' as $$
declare job private.mm_push_jobs;begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'not_authorized';end if;
 select * into job from private.mm_push_jobs where id=p_job and lease=p_lease and lease_until>now() for update;if not found then return;end if;
 if p_result='invalid' then
  delete from private.mm_push_devices where installation=job.installation and owner_id=job.owner_id;return;
 end if;
 if p_result not in ('accepted','delivered','retry','permanent')then raise exception 'invalid_result';end if;
 if p_result='accepted' and (p_ticket is null or length(p_ticket)>160)then raise exception 'invalid_ticket';end if;
 update private.mm_push_jobs set state=case when p_result='accepted' then 'receipt' when p_result='delivered' then 'done' when p_result='permanent' or attempts>=7 then 'failed' else state end,
 ticket=case when p_result='accepted' then p_ticket else ticket end,attempts=attempts+1,
 next_at=now()+case when p_result='accepted' then interval '15 minutes' else least(interval '1 hour',interval '1 minute'*power(2,least(attempts,6)))end,
 lease=null,lease_until=null where id=p_job and lease=p_lease;
end $$;
revoke all on function public.mm_register_push(uuid,text),public.mm_claim_push_jobs(),public.mm_finish_push_job(uuid,uuid,text,text),private.mm_enqueue_push()from public,anon,authenticated;
grant execute on function public.mm_register_push(uuid,text)to anon,authenticated;
grant execute on function public.mm_claim_push_jobs(),public.mm_finish_push_job(uuid,uuid,text,text)to service_role;
notify pgrst,'reload schema';
commit;
