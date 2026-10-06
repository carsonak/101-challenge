# Database boundary

`createDatabase` supplies a Drizzle client, bounded readiness probe and shutdown. Domain tables/migrations are deliberately not invented in the skeleton. Implement the reviewed initial schema at tracker gate F1 and test with PostgreSQL. Queue schema creation is currently owned by pg-boss startup on the disposable local database; production roles/migrations require the deployment gate.
