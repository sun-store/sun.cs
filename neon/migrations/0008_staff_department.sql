-- Dział pracownika: domyślny filtr kolejki (Support widzi wszystko).
alter table allowlist
  add column if not exists department text not null default 'cs';

alter table staff
  add column if not exists department text not null default 'cs';

alter table allowlist drop constraint if exists allowlist_department_check;
alter table allowlist
  add constraint allowlist_department_check
  check (department in ('cs', 'logistics', 'finance', 'merchant_success', 'product'));

alter table staff drop constraint if exists staff_department_check;
alter table staff
  add constraint staff_department_check
  check (department in ('cs', 'logistics', 'finance', 'merchant_success', 'product'));
