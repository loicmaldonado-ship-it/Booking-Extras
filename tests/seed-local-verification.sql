DO $test$ BEGIN
IF (SELECT count(*) FROM supabase_migrations.schema_migrations) <> 180 THEN RAISE EXCEPTION 'migrations'; END IF;
IF (SELECT count(*) FROM auth.users WHERE email IN ('cheffe.test@test-chat-charge.fr','assistante.test@test-chat-charge.fr')) <> 2 THEN RAISE EXCEPTION 'auth seed'; END IF;
IF (SELECT count(*) FROM public.profiles WHERE id IN ('00000000-0000-4000-8000-00000000c0c0','00000000-0000-4000-8000-00000000a551')) <> 2 THEN RAISE EXCEPTION 'profiles'; END IF;
IF NOT EXISTS (SELECT FROM public.projets WHERE id='00000000-0000-4000-8000-0000000070e0') THEN RAISE EXCEPTION 'project'; END IF;
IF NOT EXISTS (SELECT FROM public.annonces WHERE id='00000000-0000-4000-8000-00000000a000') THEN RAISE EXCEPTION 'annonce'; END IF;
IF NOT EXISTS (SELECT FROM public.candidatures WHERE id='00000000-0000-4000-8000-00000000cd01') THEN RAISE EXCEPTION 'candidature'; END IF;
IF NOT EXISTS (SELECT FROM public.figurant_comptes WHERE figurant_id='00000000-0000-4000-8000-00000000f001') THEN RAISE EXCEPTION 'candidate password'; END IF;
END $test$;