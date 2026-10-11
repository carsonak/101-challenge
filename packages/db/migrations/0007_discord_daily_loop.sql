-- Extend metadata-only actor-bound interactions; existing forms remain valid until expiry.
ALTER TABLE adapter_confirmations DROP CONSTRAINT adapter_confirmations_kind_check;
ALTER TABLE adapter_confirmations ADD CONSTRAINT adapter_confirmations_kind_check
 CHECK(kind IN ('setup','update','edit','cancel','restart','dashboard','report','start','pause','resume','custom'));
