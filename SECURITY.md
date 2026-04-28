# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security vulnerabilities. Instead, email:

**ieuan@ubik.studio** — subject line `[security] tag-kit: <short description>`

Include:

- A description of the vulnerability
- Steps to reproduce
- The affected package(s) and version(s)
- Any proof-of-concept code (attach privately)

You can expect an acknowledgement within 72 hours and a remediation plan within 7 days for confirmed issues.

## Supported versions

tag-kit is pre-1.0; only the latest minor version receives security patches. Once v1.0 ships, this policy will be updated to cover the latest two minors.

| Version | Supported |
|---|---|
| 0.1.x | ✅ |
| < 0.1 | ❌ |

## Scope

In scope:

- `@tag-kit/core` — schema, scope-matching, scoring math, catalog helpers
- `@tag-kit/ui` — `TagPicker`, `TagChip`, render-prop integration

Out of scope:

- Vulnerabilities in upstream dependencies (report directly to maintainers; we'll track via Dependabot)
- Issues requiring a malicious catalog the user wrote themselves — catalogs are trusted input. `defineCatalog` validates structure, but the values you put in your catalog (e.g. `tagId` strings, descriptions) are your responsibility to sanitize before rendering as HTML
- Issues that require an attacker to control the React render tree above `@tag-kit/ui` components

## Disclosure

We follow coordinated disclosure — confirmed issues get a fix, a CVE if warranted, and a public advisory via GitHub Security Advisories after the patch ships.
