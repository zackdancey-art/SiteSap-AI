#!/usr/bin/env bash
# Run once after cloning: installs the git pre-commit hook into .git/hooks/
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
HOOK="$ROOT/.git/hooks/pre-commit"

cat > "$HOOK" <<'EOF'
#!/usr/bin/env bash
# Pre-commit hook: typecheck + tests must pass before every commit
set -euo pipefail

cd "$(git rev-parse --show-toplevel)/Projects"

echo "🔍 Running typecheck..."
pnpm run typecheck

echo "🧪 Running tests..."
pnpm run test

echo "✅ All checks passed."
EOF

chmod +x "$HOOK"
echo "Pre-commit hook installed at $HOOK"
