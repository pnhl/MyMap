-- Runs only fixture records and rolls EVERYTHING back. No real friend receives anything.
begin;
do $$
declare a uuid;b uuid;e uuid;mid uuid:=gen_random_uuid();gid uuid;root text;rid uuid:=gen_random_uuid();
begin
 perform set_config('request.jwt.claims','{"iss":"https://securetoken.google.com/mymap-a3ae4","aud":"mymap-a3ae4","sub":"mymap-moment-qa-alice-20261005"}',true);a:=public.mm_identity();
 perform set_config('request.jwt.claims','{"iss":"https://securetoken.google.com/mymap-a3ae4","aud":"mymap-a3ae4","sub":"mymap-moment-qa-bob-20261005"}',true);b:=public.mm_identity();
 perform set_config('request.jwt.claims','{"iss":"https://securetoken.google.com/mymap-a3ae4","aud":"mymap-a3ae4","sub":"mymap-moment-qa-eve-20261005"}',true);e:=public.mm_identity();
 insert into public.vc_connections(requester_id,addressee_id,status) values(a,b,'accepted');
 root:=a::text||'/'||mid::text;
 insert into storage.objects(bucket_id,name) values('mymap-moments',root||'/photo.jpg');
 perform set_config('request.jwt.claims','{"iss":"https://securetoken.google.com/mymap-a3ae4","aud":"mymap-a3ae4","sub":"mymap-moment-qa-alice-20261005"}',true);
 execute 'set local role anon';
 gid:=public.mm_create_group('QA diary',array[b]);
 perform public.mm_publish(mid,'photo','QA',now(),0,array[b],gid);
 perform public.mm_publish(mid,'photo','Changed',now(),0,array[e]);
 if (select caption from public.mm_moments where id=mid)<>'QA' then raise exception 'Idempotency failed';end if;
 if not private.mm_view(mid) then raise exception 'Owner cannot view';end if;
 perform set_config('request.jwt.claims','{"iss":"https://securetoken.google.com/mymap-a3ae4","aud":"mymap-a3ae4","sub":"mymap-moment-qa-bob-20261005"}',true);
 if not private.mm_view(mid) or not private.mm_object_read(root||'/photo.jpg') then raise exception 'Recipient denied';end if;
 if jsonb_array_length(public.mm_feed(gid,null,100))<>1 then raise exception 'Group feed wrong';end if;
 perform public.mm_reply(rid,mid,'text','Fixture reply');
 begin perform public.mm_delete(mid);raise exception 'Non-owner deletion succeeded';exception when others then if sqlerrm<>'not_owner' then raise;end if;end;
 perform set_config('request.jwt.claims','{"iss":"https://securetoken.google.com/mymap-a3ae4","aud":"mymap-a3ae4","sub":"mymap-moment-qa-eve-20261005"}',true);
 if private.mm_view(mid) or private.mm_object_read(root||'/photo.jpg') then raise exception 'Stranger accessed media';end if;
 if exists(select 1 from public.mm_moments where id=mid) or exists(select 1 from public.mm_replies where id=rid) then raise exception 'Stranger bypassed table RLS';end if;
 begin perform public.mm_reply(gen_random_uuid(),mid,'text','Blocked');raise exception 'Stranger reply succeeded';exception when others then if sqlerrm<>'not_allowed' then raise;end if;end;
 perform set_config('request.jwt.claims','{"iss":"https://securetoken.google.com/mymap-a3ae4","aud":"mymap-a3ae4","sub":"mymap-moment-qa-bob-20261005"}',true);
 perform public.mm_leave_group(gid);
 if private.mm_view(mid) then raise exception 'Former group member retained access';end if;
 perform set_config('request.jwt.claims','{}',true);
 begin perform public.mm_feed();raise exception 'Unsigned caller succeeded';exception when sqlstate '28000' then null;end;
 execute 'reset role';
end $$;
rollback;
select 'PASS: owner, recipient, stranger, media ACL, replies, group leave, duplicate publish and unsigned caller' as result;
