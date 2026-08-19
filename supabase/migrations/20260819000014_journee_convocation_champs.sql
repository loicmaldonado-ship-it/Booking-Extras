alter table public.journees
  add column if not exists convocation_precisions text,
  add column if not exists convocation_hmc text,
  add column if not exists convocation_accessoires text,
  add column if not exists convocation_commentaires text;
