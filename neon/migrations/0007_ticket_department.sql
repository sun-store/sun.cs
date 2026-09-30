-- Dział sprawy: widok zespołu + migracja między Support / Logistyka / Finanse / MS / Produkt.
alter table tickets
  add column if not exists department text not null default 'cs';

alter table tickets
  drop constraint if exists tickets_department_check;

alter table tickets
  add constraint tickets_department_check
  check (department in ('cs', 'logistics', 'finance', 'merchant_success', 'product'));

update tickets
set department = case
  when source_category ilike '%DBSS Issue%'
    or source_category ilike '%Logistics Issue%' then 'logistics'
  when source_category ilike '%sun.finance%'
    or source_category ilike '%No VAT%' then 'finance'
  when source_category ilike '%Claim%'
    or source_category ilike '%Unresponsive seller%' then 'merchant_success'
  when source_category ilike '%Offer request%'
    or source_category ilike '%Lost on platform%' then 'product'
  when category = 'delivery' then 'logistics'
  when category = 'payment' then 'finance'
  when category = 'product' then 'product'
  else 'cs'
end;

create index if not exists tickets_department_idx on tickets (department);
