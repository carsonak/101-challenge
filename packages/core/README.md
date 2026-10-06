# Application core

Framework-independent services live here. The skeleton contains only an injected readiness probe. Domain services, clocks, transactions and authorization follow the accepted tracker plans. Depend on repository ports rather than importing the database or adapters.
