-- « Voiture » manquait dans les types de véhicule (vélo, moto, scooter),
-- alors qu'au moins un type était obligatoire : des candidat·es avec une
-- voiture ont coché vélo ou moto par défaut (« on ne peut pas cocher
-- voiture, j'ai mis vélo par défaut »).

alter table public.figurants
  add column if not exists vehicule_voiture boolean not null default false;

-- Reprise de l'existant : marque saisie qui désigne clairement une voiture
-- (constructeur ou modèle automobile, ou le mot « voiture »).
with detection as (
  select id,
         vehicule_marque ~* '(voiture|\mauto\M|peugeot|renault|citro[eë]n|dacia|audi|bmw|mercedes|volkswagen|\mvw\M|golf|\mpolo\M|fiat|panda|\mkia\M|hyundai|toyota|yaris|nissan|opel|\mford\M|\mseat\M|skoda|tesla|suzuki|swift|\mmini\M|clio|twingo|m[ée]gane|sc[ée]nic|\mc[345]\M|\m20[678]\M|\m30[78]\M|\m[23]008\M|sandero|duster|alfa|volvo|mazda|civic|\mjazz\M|\msmart\M|lexus|jeep|land rover|range rover|i10|i20|ceed)' as voiture,
         -- Deux-roues mentionné aussi (hors « vélo par défaut »), ou plusieurs
         -- véhicules listés (« … et voiture … ») : on garde les cases cochées.
         regexp_replace(vehicule_marque, 'v[ée]lo par d[ée]faut', '', 'gi')
           ~* '(moto|scooter|v[ée]lo|\mvtt\M|trott?inette|yamaha|kawasaki|ducati|harley|triumph|\mktm\M|vespa|piaggio|transalp|africa twin|segway|xiaomi|d[ée]cathlon|rockrider|btwin|sacoche|\met\M)' as garde_deux_roues
    from public.figurants
   where a_vehicule and vehicule_marque is not null
)
update public.figurants f
   set vehicule_voiture = true,
       vehicule_velo = case when d.garde_deux_roues then f.vehicule_velo else false end,
       vehicule_moto = case when d.garde_deux_roues then f.vehicule_moto else false end,
       vehicule_scooter = case when d.garde_deux_roues then f.vehicule_scooter else false end
  from detection d
 where d.id = f.id
   and d.voiture;
