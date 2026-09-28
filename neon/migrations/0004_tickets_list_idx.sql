-- Lista inboxu sortuje po business_changed_at. Bez indeksu każdy odczyt skanuje tabelę.
create index if not exists tickets_business_changed_idx
  on tickets (business_changed_at desc);
