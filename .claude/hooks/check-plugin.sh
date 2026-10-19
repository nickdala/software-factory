#!/usr/bin/env bash
# Stop hook: check the plugin before Claude ends a turn that changed it.
# Runs `claude plugin validate`, `claude plugin test`, an agent/skill frontmatter
# check (validate doesn't parse it) and the example-dashboard symlink. Skips when no
# plugin file has uncommitted changes, or when this exact change already passed.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
input=$(cat)

paths=(.claude-plugin agents skills hooks types templates scripts references examples)
[ -z "$(git status --porcelain -- "${paths[@]}")" ] && exit 0

# Fingerprint of the current change: the diff plus the contents of untracked files.
fingerprint=$(
  {
    git diff HEAD -- "${paths[@]}"
    git ls-files -o --exclude-standard -z -- "${paths[@]}" | xargs -0 cat 2>/dev/null
  } | shasum | cut -d' ' -f1
)
stamp="$(git rev-parse --git-dir)/plugin-check.ok"
[ "$(cat "$stamp" 2>/dev/null)" = "$fingerprint" ] && exit 0

report=$(mktemp)
trap 'rm -f "$report"' EXIT

if ! out=$(claude plugin validate . 2>&1); then
  printf '## claude plugin validate . failed\n%s\n\n' "$out" >>"$report"
fi
if ! out=$(claude plugin test . 2>&1); then
  printf '## claude plugin test . failed\n%s\n\n' "$out" >>"$report"
fi
if ! out=$(ruby - 2>&1 <<'RUBY'
require "yaml"
bad = []
(Dir["agents/*.md"] + Dir["skills/*/SKILL.md"]).sort.each do |f|
  m = File.read(f).match(/\A---\n(.*?)\n---\n/m)
  next bad << "#{f}: no frontmatter" unless m
  begin
    fm = YAML.safe_load(m[1])
  rescue => e
    next bad << "#{f}: #{e.message}"
  end
  next bad << "#{f}: frontmatter is not a mapping" unless fm.is_a?(Hash)
  want = f.start_with?("agents/") ? File.basename(f, ".md") : File.basename(File.dirname(f))
  bad << "#{f}: name is #{fm["name"].inspect}, expected #{want.inspect}" unless fm["name"] == want
  bad << "#{f}: missing description" if fm["description"].to_s.strip.empty?
end
puts bad
exit(bad.empty? ? 0 : 1)
RUBY
); then
  printf '## agent/skill frontmatter is broken\n%s\n\n' "$out" >>"$report"
fi
if [ ! -L examples/factory/dashboard.html ] || [ ! -f examples/factory/dashboard.html ]; then
  printf '## examples/factory/dashboard.html is no longer a working symlink to ../../templates/dashboard.html\n\n' >>"$report"
fi

if [ ! -s "$report" ]; then
  echo "$fingerprint" >"$stamp"
  exit 0
fi

# Block once so Claude can fix it; on the retry, report to the user instead of looping.
if [ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ]; then
  jq -n --arg msg "Plugin checks still failing:"$'\n'"$(cat "$report")" '{systemMessage: $msg}'
  exit 0
fi
cat "$report" >&2
exit 2
