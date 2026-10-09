begin;
do $$
declare legacy uuid:=gen_random_uuid();resolved uuid;
begin
 insert into public.vc_profiles(id,display_name,avatar_path) values(legacy,'Legacy QA',null) on conflict(id) do update set avatar_path=null;
 insert into auth.users(id,email,created_at,updated_at) values(legacy,'mymap-avatar-legacy-qa@example.invalid',now(),now());
 perform set_config('request.jwt.claims','{"iss":"https://securetoken.google.com/mymap-a3ae4","aud":"mymap-a3ae4","sub":"avatar-new-firebase-legacy-qa","email":"mymap-avatar-legacy-qa@example.invalid","email_verified":true,"picture":"https://example.invalid/oauth-avatar.jpg"}',true);
 execute 'set local role anon';resolved:=public.mm_identity();
 if resolved<>legacy then raise exception 'Verified legacy identity was not preserved';end if;
 if public.mm_profile_read()->>'avatar_path' is not null then raise exception 'OAuth overwrote the owned avatar';end if;
 perform public.mm_profile_update('Legacy linked QA','Updated after first Firebase login');
 if public.mm_profile_read()->>'bio'<>'Updated after first Firebase login' then raise exception 'Linked profile cannot update';end if;
 execute 'reset role';
end $$;
rollback;
select 'PASS: first Firebase login links verified legacy account with null avatar without recursive provisioning' as result;
