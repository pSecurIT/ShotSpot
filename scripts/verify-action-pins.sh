#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW_DIR="$ROOT_DIR/.github/workflows"

if [ ! -d "$WORKFLOW_DIR" ]; then
  echo "::error::Workflow directory not found: $WORKFLOW_DIR"
  exit 1
fi

declare -A latest_tag_cache
declare -A latest_sha_cache
declare -A checked_refs

non_pinned=0
outdated_pins=0
checked_total=0

get_repo_from_action() {
  local action_ref="$1"
  IFS='/' read -r -a parts <<< "$action_ref"

  if [ "${#parts[@]}" -lt 2 ]; then
    echo ""
    return
  fi

  echo "${parts[0]}/${parts[1]}"
}

get_latest_semver_tag() {
  local repo="$1"

  if [ -n "${latest_tag_cache[$repo]:-}" ]; then
    echo "${latest_tag_cache[$repo]}"
    return
  fi

  local tags
  tags="$(git ls-remote --tags --refs "https://github.com/${repo}.git" 2>/dev/null | awk '{print $2}' | sed 's#refs/tags/##')"

  if [ -z "$tags" ]; then
    latest_tag_cache[$repo]=""
    echo ""
    return
  fi

  local latest
  latest="$(printf '%s\n' "$tags" | grep -E '^v?[0-9]+(\.[0-9]+){1,2}([.-][0-9A-Za-z.-]+)?$' | sort -V | tail -n 1 || true)"

  latest_tag_cache[$repo]="$latest"
  echo "$latest"
}

get_tag_commit_sha() {
  local repo="$1"
  local tag="$2"
  local cache_key="${repo}::${tag}"

  if [ -n "${latest_sha_cache[$cache_key]:-}" ]; then
    echo "${latest_sha_cache[$cache_key]}"
    return
  fi

  local sha
  sha="$(git ls-remote "https://github.com/${repo}.git" "refs/tags/${tag}^{}" | awk '{print $1}' | head -n 1)"

  if [ -z "$sha" ]; then
    sha="$(git ls-remote "https://github.com/${repo}.git" "refs/tags/${tag}" | awk '{print $1}' | head -n 1)"
  fi

  latest_sha_cache[$cache_key]="$sha"
  echo "$sha"
}

echo "Checking workflow action pins in $WORKFLOW_DIR"

while IFS= read -r -d '' file; do
  while IFS= read -r match; do
    line_number="${match%%:*}"
    line_text="${match#*:}"

    use_value="$(printf '%s\n' "$line_text" | sed -E 's/^[[:space:]]*uses:[[:space:]]*([^[:space:]#]+).*$/\1/')"

    # Skip Docker registry actions and local actions.
    if [[ "$use_value" == docker://* || "$use_value" == ./* ]]; then
      continue
    fi

    action_path="${use_value%@*}"
    ref="${use_value##*@}"

    if [[ ! "$ref" =~ ^[0-9a-fA-F]{40}$ ]]; then
      echo "::error file=${file#"$ROOT_DIR/"},line=$line_number::Action reference is not SHA-pinned: $use_value"
      non_pinned=$((non_pinned + 1))
      continue
    fi

    checked_total=$((checked_total + 1))

    repo="$(get_repo_from_action "$action_path")"
    if [ -z "$repo" ]; then
      echo "::warning file=${file#"$ROOT_DIR/"},line=$line_number::Could not resolve repository for action: $use_value"
      continue
    fi

    ref_key="${repo}@${ref}"
    if [ -n "${checked_refs[$ref_key]:-}" ]; then
      continue
    fi
    checked_refs[$ref_key]="1"

    latest_tag="$(get_latest_semver_tag "$repo")"
    if [ -z "$latest_tag" ]; then
      echo "::warning::No semver-like tags found for $repo; skipping update check"
      continue
    fi

    latest_sha="$(get_tag_commit_sha "$repo" "$latest_tag")"
    if [ -z "$latest_sha" ]; then
      echo "::warning::Could not resolve tag commit for $repo@$latest_tag"
      continue
    fi

    if [ "${ref,,}" != "${latest_sha,,}" ]; then
      echo "::warning file=${file#"$ROOT_DIR/"},line=$line_number::Update available for $repo: pinned ${ref:0:12}, latest tag $latest_tag (${latest_sha:0:12})"
      outdated_pins=$((outdated_pins + 1))
    fi
  done < <(grep -nE '^[[:space:]]*uses:[[:space:]]*[^[:space:]#]+' "$file" || true)
done < <(find "$WORKFLOW_DIR" -maxdepth 1 -type f -name '*.yml' -print0)

echo "Checked $checked_total SHA-pinned action references."

if [ "$non_pinned" -gt 0 ]; then
  echo "::error::Found $non_pinned non-SHA action references."
fi

if [ "$outdated_pins" -gt 0 ]; then
  echo "::error::Found $outdated_pins SHA-pinned references that are behind latest semver tags."
fi

if [ "$non_pinned" -gt 0 ] || [ "$outdated_pins" -gt 0 ]; then
  exit 1
fi

echo "All workflow action references are SHA-pinned and up to date."
