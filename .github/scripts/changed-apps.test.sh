#!/usr/bin/env bash
# Checks changed-apps.sh against sample diffs. Run: bash .github/scripts/changed-apps.test.sh
set -euo pipefail
script="$(dirname "$0")/changed-apps.sh"
all=$(ls "$(dirname "$0")/../../apps" | jq -Rsc 'split("\n") | map(select(length > 0))')
fail=0

# expect <description> <changed files> <js> <android> <ios>
expect() {
  got=$(printf '%s' "$2" | bash "$script" | grep -v '^filter=' | tr '\n' ' ')
  want="js=$3 android=$4 ios=$5 "
  if [ "$got" = "$want" ]; then echo "ok   $1"; else echo "FAIL $1"$'\n'"  got:  $got"$'\n'"  want: $want"; fail=1; fi
}

expect "js-only app change skips native" \
  $'apps/cowrite/App.tsx\napps/cowrite/src/x.ts' '["cowrite"]' '[]' '[]'
expect "ios change builds only ios" \
  $'apps/cowrite/ios/Podfile' '["cowrite"]' '[]' '["cowrite"]'
expect "gemfile change builds only ios" \
  $'apps/orderup/Gemfile.lock' '["orderup"]' '[]' '["orderup"]'
expect "android change builds only android" \
  $'apps/orderup/android/app/build.gradle' '["orderup"]' '["orderup"]' '[]'
expect "app package.json builds both" \
  $'apps/cowrite/package.json\napps/orderup/App.tsx' '["cowrite","orderup"]' '["cowrite"]' '["cowrite"]'
expect "shared js package checks every app, no native" \
  $'packages/mesh/src/index.ts\napps/cowrite/ios/Podfile' "$all" '[]' '["cowrite"]'
expect "lockfile runs everything" \
  $'pnpm-lock.yaml' "$all" "$all" "$all"
expect "ci change runs everything" \
  $'.github/workflows/ci.yml' "$all" "$all" "$all"
expect "docs only runs nothing" \
  $'README.md\napps/cowrite/demo.gif\ndocs/plan.md' '[]' '[]' '[]'
expect "removed app is ignored" \
  $'apps/removed/ios/Podfile' '[]' '[]' '[]'
expect "no changes runs nothing" '' '[]' '[]' '[]'

got=$(bash "$script" all | tr '\n' ' ')
want="js=$all android=$all ios=$all filter= "
[ "$got" = "$want" ] && echo "ok   push to main runs everything" || { echo "FAIL push to main: $got"; fail=1; }

got=$(printf 'apps/cowrite/App.tsx\napps/orderup/App.tsx' | bash "$script" | grep '^filter=')
[ "$got" = "filter=--filter=@offline-app-examples/cowrite --filter=@offline-app-examples/orderup" ] \
  && echo "ok   turbo filter" || { echo "FAIL turbo filter: $got"; fail=1; }

exit $fail
