#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW_DIR="$ROOT_DIR/.github/workflows"
STRICT_UPDATES="${STRICT_UPDATES:-false}"
TARGET_FILE_LIST_PATH="${TARGET_FILE_LIST_PATH:-}"
REPORT_JSON_PATH="${REPORT_JSON_PATH:-$ROOT_DIR/.artifacts/action-pin-report.json}"
REPORT_MD_PATH="${REPORT_MD_PATH:-$ROOT_DIR/.artifacts/action-pin-report.md}"
SEP=$'\x1f'

if [ ! -d "$WORKFLOW_DIR" ]; then
  echo "::error::Workflow directory not found: $WORKFLOW_DIR"
  exit 1
fi

normalize_bool() {
  local value="${1:-false}"
  case "${value,,}" in
    1|true|yes|on)
      echo "true"
      ;;
    *)
      echo "false"
      ;;
  esac
}

escape_json() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

as_relative_path() {
  local path="$1"
  printf '%s' "${path#"$ROOT_DIR/"}"
}

STRICT_UPDATES="$(normalize_bool "$STRICT_UPDATES")"
mkdir -p "$(dirname "$REPORT_JSON_PATH")"
mkdir -p "$(dirname "$REPORT_MD_PATH")"

declare -A latest_tag_cache
declare -A latest_sha_cache
declare -A checked_refs

non_pinned=0
outdated_pins=0
checked_total=0
uses_total=0
declare -a workflow_files
declare -a findings

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

add_finding() {
  local type="$1"
  local file="$2"
  local line="$3"
  local action="$4"
  local repo="$5"
  local pinned_ref="$6"
  local latest_tag="$7"
  local latest_sha="$8"
  local message="$9"

  findings+=("$type$SEP$file$SEP$line$SEP$action$SEP$repo$SEP$pinned_ref$SEP$latest_tag$SEP$latest_sha$SEP$message")
}

load_workflow_files() {
  if [ -n "$TARGET_FILE_LIST_PATH" ] && [ -f "$TARGET_FILE_LIST_PATH" ]; then
    while IFS= read -r rel_path; do
      rel_path="${rel_path%$'\r'}"
      if [ -z "$rel_path" ]; then
        continue
      fi

      if [[ "$rel_path" != .github/workflows/*.yml ]]; then
        continue
      fi

      local abs_path="$ROOT_DIR/$rel_path"
      if [ -f "$abs_path" ]; then
        workflow_files+=("$abs_path")
      fi
    done < "$TARGET_FILE_LIST_PATH"
  else
    while IFS= read -r -d '' file; do
      workflow_files+=("$file")
    done < <(find "$WORKFLOW_DIR" -maxdepth 1 -type f -name '*.yml' -print0 | sort -z)
  fi
}

write_reports() {
  local pass_status="$1"
  local generated_at
  generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  {
    echo "# Action Pin Verification Report"
    echo
    echo "- Generated (UTC): $generated_at"
    echo "- Strict updates mode: $STRICT_UPDATES"
    echo "- Workflow files scanned: ${#workflow_files[@]}"
    echo "- uses lines scanned: $uses_total"
    echo "- SHA-pinned refs checked: $checked_total"
    echo "- Non-SHA refs: $non_pinned"
    echo "- Outdated SHA refs: $outdated_pins"
    echo "- Pass: $pass_status"
    echo

    if [ "${#findings[@]}" -eq 0 ]; then
      echo "No findings."
    else
      echo "| Type | Location | Action | Message |"
      echo "| --- | --- | --- | --- |"
      for finding in "${findings[@]}"; do
        IFS="$SEP" read -r type file line action repo pinned_ref latest_tag latest_sha message <<< "$finding"
        echo "| $type | $file:$line | $action | $message |"
      done
    fi
  } > "$REPORT_MD_PATH"

  {
    echo "{"
    echo "  \"generatedAtUtc\": \"$(escape_json "$generated_at")\"," 
    echo "  \"strictUpdates\": $STRICT_UPDATES,"
    echo "  \"workflowFilesScanned\": ${#workflow_files[@]},"
    echo "  \"usesLinesScanned\": $uses_total,"
    echo "  \"shaPinnedRefsChecked\": $checked_total,"
    echo "  \"nonShaRefs\": $non_pinned,"
    echo "  \"outdatedShaRefs\": $outdated_pins,"
    echo "  \"pass\": $pass_status,"

    echo "  \"scannedFiles\": ["
    for i in "${!workflow_files[@]}"; do
      rel_file="$(as_relative_path "${workflow_files[$i]}")"
      if [ "$i" -gt 0 ]; then
        echo ","
      fi
      echo -n "    \"$(escape_json "$rel_file")\""
    done
    if [ "${#workflow_files[@]}" -gt 0 ]; then
      echo
    fi
    echo "  ],"

    echo "  \"findings\": ["
    for i in "${!findings[@]}"; do
      IFS="$SEP" read -r type file line action repo pinned_ref latest_tag latest_sha message <<< "${findings[$i]}"
      if [ "$i" -gt 0 ]; then
        echo ","
      fi
      echo "    {"
      echo "      \"type\": \"$(escape_json "$type")\","
      echo "      \"file\": \"$(escape_json "$file")\","
      echo "      \"line\": $line,"
      echo "      \"action\": \"$(escape_json "$action")\","
      echo "      \"repo\": \"$(escape_json "$repo")\","
      echo "      \"pinnedRef\": \"$(escape_json "$pinned_ref")\","
      echo "      \"latestTag\": \"$(escape_json "$latest_tag")\","
      echo "      \"latestSha\": \"$(escape_json "$latest_sha")\","
      echo "      \"message\": \"$(escape_json "$message")\""
      echo -n "    }"
    done
    if [ "${#findings[@]}" -gt 0 ]; then
      echo
    fi
    echo "  ]"
    echo "}"
  } > "$REPORT_JSON_PATH"
}

echo "Checking workflow action pins in $WORKFLOW_DIR"
echo "Strict update mode: $STRICT_UPDATES"

load_workflow_files

if [ "${#workflow_files[@]}" -eq 0 ]; then
  echo "No workflow files selected for scanning."
  write_reports "true"
  echo "Reports written to: $REPORT_JSON_PATH and $REPORT_MD_PATH"
  exit 0
fi

for file in "${workflow_files[@]}"; do
  while IFS= read -r match; do
    line_number="${match%%:*}"
    line_text="${match#*:}"
    uses_total=$((uses_total + 1))

    use_value="$(printf '%s\n' "$line_text" | sed -E 's/^[[:space:]]*uses:[[:space:]]*([^[:space:]#]+).*$/\1/')"

    # Skip Docker registry actions and local actions.
    if [[ "$use_value" == docker://* || "$use_value" == ./* ]]; then
      continue
    fi

    action_path="${use_value%@*}"
    ref="${use_value##*@}"

    if [[ ! "$ref" =~ ^[0-9a-fA-F]{40}$ ]]; then
      file_rel="$(as_relative_path "$file")"
      message="Action reference is not SHA-pinned: $use_value"
      echo "::error file=$file_rel,line=$line_number::$message"
      add_finding "non_sha" "$file_rel" "$line_number" "$use_value" "" "$ref" "" "" "$message"
      non_pinned=$((non_pinned + 1))
      continue
    fi

    checked_total=$((checked_total + 1))

    repo="$(get_repo_from_action "$action_path")"
    if [ -z "$repo" ]; then
      file_rel="$(as_relative_path "$file")"
      echo "::warning file=$file_rel,line=$line_number::Could not resolve repository for action: $use_value"
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
      file_rel="$(as_relative_path "$file")"
      message="Update available for $repo: pinned ${ref:0:12}, latest tag $latest_tag (${latest_sha:0:12})"
      echo "::warning file=$file_rel,line=$line_number::$message"
      add_finding "outdated_sha" "$file_rel" "$line_number" "$use_value" "$repo" "$ref" "$latest_tag" "$latest_sha" "$message"
      outdated_pins=$((outdated_pins + 1))
    fi
  done < <(grep -nE '^[[:space:]]*uses:[[:space:]]*[^[:space:]#]+' "$file" || true)
done

echo "Checked $checked_total SHA-pinned action references."

if [ "$non_pinned" -gt 0 ]; then
  echo "::error::Found $non_pinned non-SHA action references."
fi

if [ "$outdated_pins" -gt 0 ]; then
  if [ "$STRICT_UPDATES" = "true" ]; then
    echo "::error::Found $outdated_pins SHA-pinned references that are behind latest semver tags."
  else
    echo "::warning::Found $outdated_pins SHA-pinned references behind latest semver tags (non-blocking in default mode)."
  fi
fi

pass_status="true"
if [ "$non_pinned" -gt 0 ]; then
  pass_status="false"
fi
if [ "$STRICT_UPDATES" = "true" ] && [ "$outdated_pins" -gt 0 ]; then
  pass_status="false"
fi

write_reports "$pass_status"
echo "Reports written to: $REPORT_JSON_PATH and $REPORT_MD_PATH"

if [ "$pass_status" = "false" ]; then
  exit 1
fi

echo "All workflow action references are SHA-pinned and up to date."
