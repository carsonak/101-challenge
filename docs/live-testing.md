# Local live testing

Build and first verify against a dedicated fictional-data PostgreSQL database. Live-provider identities and personal recipients require a separate private database whose storage and logs are outside synthetic artifacts. Use separate web, worker and maintenance environments and logins; never give the web migration or erasure credentials. Keep APP_ORIGIN on localhost with the selected web port (3000 by default). Configure exact Google and Discord callbacks on that origin in the provider consoles. Google requests OpenID and profile, deliberately excluding email; matching provider email never links identities.

Confirm `cloudflared --version`, run `pnpm discord:proxy`, then run `cloudflared tunnel --url http://127.0.0.1:3002` in a separate terminal. A user-space binary can run in the foreground; sudo and system-service installation are unnecessary. Only exact POST /api/discord passes the proxy. Do not tunnel the application port: that exposes the full website. Update the Discord interactions URL to the new tunnel hostname plus /api/discord on each restart. The proxy preserves the signed bytes and does not log bodies, query strings or tokens. Discord website links remain local and are usable only on the owner's computer. Quick tunnels are temporary development infrastructure, not a community web deployment.

Load Google client settings from the supplied private file into ignored .env, plus the exact callback. Configure Brevo SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_USER, SMTP_PASSWORD and SMTP_SECURE there; use the provider's authenticated sender. Keep DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in .env.operator; DISCORD_CLIENT_ID remains in .env. The scoped registration command receives only those settings. The web runtime uses only the OAuth client/secret/callback and interaction public key. Never paste secrets into plans, logs or chat.

First use registration dry-run, then explicitly run guild registration. Confirm a signed PING and rejection of invalid signatures, then exercise sign-in, linking, cancellation, join, recommended/custom setup, report/edit, pause/resume and error recovery. Send verification and recovery mail only to owner-controlled recipients. Maintenance receives ERASURE_DATABASE_URL from .env.operator plus the shared sender/origin configuration from .env; operator credentials never enter web runtime.

Test Mailpit/provider doubles before live providers. Record local tests, live provider checks and VPS checks separately in historical verification. Neither a working tunnel nor local tests constitute a participant-release gate.

See [configuration](configuration.md), [operations](operations.md), [deployment](deployment.md) and [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

For Brevo submission checks, put LIVE_TEST_EMAIL only in ignored local configuration and run `node --env-file=.env --import tsx scripts/live-mail-check.ts` against the private local acceptance database. The script sends two owner-authorized messages, exercises the verification proof and leaves recovery available. For an already verified test account, use `--retry-recovery` to resend recovery without resetting its password or account state. SMTP acceptance does not prove inbox delivery. The MAIL_HTTP_PORT and MAIL_SMTP_PORT settings belong to local Mailpit; Brevo uses SMTP_PORT, with SMTP_SECURE=false for STARTTLS on its submission port, or true for implicit TLS.

Bot installation is separate from browser sign-in. Use Discord’s hosted authorization URL with the configured application ID, the `bot applications.commands` scopes, guild installation and the permissions actually needed by the commands. Do not add the localhost OAuth callback to that installation URL. Disable the bot’s Requires OAuth2 Code Grant option for this hosted installation flow; website sign-in continues to use its own authorization code flow. Install in the same server as DISCORD_GUILD_ID before applying guild commands.

If SMTP submission succeeds but messages do not arrive, inspect Brevo’s transactional logs before retrying. Check transactional SMTP activation, the authenticated sender/domain, delivery or rejection status and recipient blocking. Set SMTP_FROM to the exact verified sender; SMTP_USER is a technical login and does not select the From address. External SMTP configuration rejects .invalid placeholder senders. A successful SMTP authentication check proves credentials and connectivity only; `mail_accepted` records submission, while inbox delivery requires provider status and recipient confirmation. Keep recipient addresses and private message previews out of shared evidence.

On WSL, confirm the login page from Windows as well as Linux. If Windows cannot connect, inspect `netsh interface ipv4 show excludedportrange protocol=tcp` before changing firewall or WSL settings. A reserved web port can prevent localhost forwarding. Choose an unreserved loopback port, update PORT, APP_ORIGIN, both provider callback settings and their console registrations, and reload worker/maintenance origins. Put DISCORD_PROXY_TARGET in .env (or leave it blank to follow APP_ORIGIN) so the public tunnel can keep its existing proxy port and exact endpoint. Keep the website on loopback. Old email links contain the previous local port; request a new recovery link or change only its port locally without sharing its proof token.

Before starting live acceptance, verify that POSTGRES_PORT and every runtime and
operator database URL identify the intended private local stack. An occupied
PostgreSQL port belongs to its existing service; do not stop it or provision through
it without confirming ownership. Keep private provider identities separate from
the disposable synthetic database and screenshot artifacts.

Open the website using the exact APP_ORIGIN hostname and port. `localhost` and
`127.0.0.1` are different browser origins even when they reach the same server;
the API deliberately rejects POSTs from the other origin. Next.js may print its
loopback binding address instead of the configured website origin. Changing PORT
alone does not update APP_ORIGIN, OAuth callbacks or the Discord proxy target.

Record owner confirmation separately for Google and Discord sign-in, linking,
cancellation and profile behavior; verification-message inbox delivery; and Discord
join, recommended/custom setup, report/edit and pause/resume. A running tunnel or
SMTP submission alone does not complete these gates.
