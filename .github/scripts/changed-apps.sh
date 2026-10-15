#!/usr/bin/env bash
# Picks which apps each CI job runs for. Prints GITHUB_OUTPUT lines:
#   js=[...]       apps for `check` (typecheck, lint, test, JS bundle)
#   android=[...]  apps for the `android` build matrix
#   ios=[...]      apps for the `ios` build matrix
#   filter=...     turbo --filter args for `check`, empty when every app runs
#
#   changed-apps.sh all                    every app, every job (push to main)
#   git diff --name-only | changed-apps.sh  only what the changed files need
set -euo pipefail
cd "$(dirname "$0")/../.."

all=$(ls apps | jq -Rsc 'split("\n") | map(select(length > 0))')

if [ "${1:-}" = all ]; then
  js=$all android=$all ios=$all
else
  files=$(grep -vE '^docs/|\.(md|gif|png|jpe?g)$' || true)

  # Apps with a changed file under apps/<name>/ matching the pattern.
  apps_matching() {
    { grep -E "^apps/[^/]+/($1)" <<<"$files" || true; } | cut -d/ -f2 \
      | jq -Rsc --argjson all "$all" 'split("\n") | unique | map(select(IN($all[])))'
  }

  # JS: a change outside apps/ (packages/, lockfile, root config) can break any app.
  if [ -n "$files" ] && grep -qv '^apps/' <<<"$files"; then
    js=$all
  else
    js=$(apps_matching '')
  fi

  # Native: Debug builds don't bundle JS, so only native project files, native
  # dependencies (package.json, lockfile) and CI itself can break them.
  if grep -qE '^(pnpm-lock\.yaml|package\.json|pnpm-workspace\.yaml|\.npmrc|\.github/)' <<<"$files"; then
    android=$all ios=$all
  else
    android=$(apps_matching 'android/|package\.json$|react-native\.config\.js$')
    ios=$(apps_matching 'ios/|Gemfile|package\.json$|react-native\.config\.js$')
  fi
fi

# No turbo filter when every app runs, so packages/ is checked too.
filter=
if [ "$js" != "$all" ]; then
  filter=$(jq -r 'map("--filter=@offline-app-examples/" + .) | join(" ")' <<<"$js")
fi

echo "js=$js"
echo "android=$android"
echo "ios=$ios"
echo "filter=$filter"
