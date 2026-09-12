# Security reporting

Report security concerns privately to hello@sr3h.uk with enough detail to reproduce the issue. Do not post credentials, personal information or exploit details in public issues.

The public website and MCP accept public information only. The MCP is a read-only service and does not need a user's API key. Access-control rules must never depend on robots.txt, CORS or a hidden URL.

Before deploying the Worker, run its tests and dry build. Confirm the rate-limit and USAGE_GUARD bindings and set ABUSE_HASH_SECRET through Cloudflare's secret store. Never commit credentials. When the hash secret is absent, visitors share a conservative daily limit; when quota storage is absent, paid checks stop.

Application URL checks reject private address literals and recheck redirects. DNS resolution and connection-level protection still require verification in the hosting environment, including public hostnames resolving to private addresses and DNS rebinding. Do not reuse this fetcher on a network with private services without enforcing destination IP restrictions at connection time.

The GitHub Pages build excludes server source and working documentation. Files remain visible to anyone who can access the repository; exclusions are not access controls. Imported MCP skill instructions are intentionally visible to clients.
