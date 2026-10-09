const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const alice='10000000-0000-4000-8000-000000000001',bob='10000000-0000-4000-8000-000000000002',installation='20000000-0000-4000-8000-000000000001';
test('push SQL isolates owners, denies token reads, locks leases and removes stale-account deliveries',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;create schema auth;
 create function auth.jwt()returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.role()returns text language sql as $$select auth.jwt()->>'role'$$;
 create function private.mm_user()returns uuid language plpgsql as $$begin if auth.jwt()->>'iss'<>'trusted' or coalesce(auth.jwt()->>'sub','')='' then raise exception 'not_authenticated';end if;return(auth.jwt()->>'sub')::uuid;end$$;
 create table public.vc_profiles(id uuid primary key);create table public.vc_notifications(id uuid primary key default gen_random_uuid(),user_id uuid references public.vc_profiles(id),payload jsonb default '{}',created_at timestamptz default now(),read_at timestamptz);
 insert into public.vc_profiles values('${alice}'),('${bob}');`);
 await db.exec(fs.readFileSync('supabase/features/three_store_push_delivery.sql','utf8'));
 const claims=async(owner,role='anon')=>{await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({iss:'trusted',sub:owner,role})]);await db.exec('set role '+role);};
 await claims(alice);await db.query('select public.mm_register_push($1,$2)',[installation,'ExpoPushToken[alice-device-token]']);
 await assert.rejects(db.query('select token from private.mm_push_devices'),/permission denied/);
 await assert.rejects(db.query('select public.mm_claim_push_jobs()'),/permission denied/);
 await db.exec('reset role');await db.query('insert into public.vc_notifications(user_id,payload)values($1,$2)',[alice,JSON.stringify({callId:'call',roomId:'room',privateMessage:'secret'})]);
 await claims(alice,'service_role');const claimed=(await db.query('select public.mm_claim_push_jobs()as jobs')).rows[0].jobs;assert.equal(claimed.length,1);assert.equal(claimed[0].owner,alice);assert.ok(!JSON.stringify(claimed).includes('secret'));
 assert.equal((await db.query('select public.mm_claim_push_jobs()as jobs')).rows[0].jobs.length,0);
 await db.query('select public.mm_finish_push_job($1,$2,$3,$4)',[claimed[0].id,'30000000-0000-4000-8000-000000000001','delivered',null]);
 await db.exec('reset role');assert.equal((await db.query('select state from private.mm_push_jobs')).rows[0].state,'queued');
 await claims(bob);await db.query('select public.mm_register_push($1,$2)',[installation,'ExpoPushToken[alice-device-token]']);
 await db.exec('reset role');await db.query("update private.mm_push_jobs set lease_until=now()-interval '1 minute'");await claims(bob,'service_role');assert.equal((await db.query('select public.mm_claim_push_jobs()as jobs')).rows[0].jobs.length,0);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int as n from private.mm_push_jobs')).rows[0].n,0);
 await claims(bob);await db.query('select public.mm_register_push($1,$2)',[installation,null]);await db.exec('reset role');assert.equal((await db.query('select count(*)::int as n from private.mm_push_devices')).rows[0].n,0);
 }finally{await db.close();}
});
