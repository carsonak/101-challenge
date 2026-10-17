-- Password ownership no longer depends on an optional email address.
ALTER TABLE credentials ALTER COLUMN email DROP NOT NULL;
ALTER TABLE profiles DROP CONSTRAINT profiles_username_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_check
 CHECK(username ~ '^[a-z0-9_-]{3,40}$');
-- Keep existing recovery addresses/hashes intact, including ambiguous legacy addresses.
-- Application email ownership checks serialize normalized aliases and reject ambiguity.
CREATE INDEX profiles_recovery_email ON profiles("recoveryEmail")
 WHERE "recoveryEmail" IS NOT NULL;
