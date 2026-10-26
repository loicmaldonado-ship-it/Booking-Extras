do $test$
declare subject uuid:=gen_random_uuid(); booking uuid:=gen_random_uuid(); project uuid:='00000000-0000-4000-8000-0000000070e0';
begin begin
 insert into public.figurants(id,prenom,nom) values(subject,'Age','Fixture');
 set local role service_role;
 begin insert into public.bookings(figurant_id,projet_id,date) values(subject,project,current_date+10); raise exception using errcode='ZX002',message='Naissance absente acceptée'; exception when check_violation then null; end;
 insert into public.bookings(id,figurant_id,projet_id,date,statut) values(booking,subject,project,current_date+10,'annulé');
 begin update public.bookings set statut='proposé' where id=booking; raise exception using errcode='ZX002',message='Réactivation sans naissance acceptée'; exception when check_violation then null; end;
 begin insert into public.figurant_messages(figurant_id,projet_id,booking_id,sender,categorie,corps) values(subject,project,booking,'staff','convocation','TEST'); raise exception using errcode='ZX002',message='Convocation sans naissance acceptée'; exception when check_violation then null; end;
 update public.figurants set date_naissance='1990-01-01' where id=subject;
 update public.bookings set statut='proposé' where id=booking;
 insert into public.figurant_messages(figurant_id,projet_id,booking_id,sender,categorie,corps) values(subject,project,booking,'staff','convocation','TEST');
 assert exists(select 1 from public.bookings where id=booking and statut='proposé'),'Adulte refusé';
 raise exception using errcode='ZX001',message='rollback fixtures';
 exception when sqlstate 'ZX001' then null; end;
end $test$;
