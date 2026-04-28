<!--
Thanks for contributing. Keep the PR focused; split unrelated changes.
-->

## Summary

<!-- 1–3 sentences. What changed and why. -->

## Linked issue

<!-- `Closes #123` or `Refs #123`. Use `N/A` only for trivial docs fixes. -->

## Test plan

<!-- Markdown checklist of how this was verified. -->

- [ ] `pnpm -r build` green
- [ ] `pnpm -r typecheck` green
- [ ] `pnpm -r test` green
- [ ] `pnpm -r lint` green
- [ ] Exercised UI primitives in a consumer app (if `@tag-kit/ui` changed)

## Scope check

<!-- Confirm none of the README "What tag-kit is NOT" guardrails are crossed. Delete this section only for trivial doc/typo PRs. -->

- [ ] No new runtime deps added to `@tag-kit/core`
- [ ] `tagId` stability preserved (no rename of `tagId`s in shipped catalogs/examples)
- [ ] No CSS shipped from `@tag-kit/ui`
