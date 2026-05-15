#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW_DIR="$ROOT_DIR/.github/workflows"
TARGET_FILE_LIST_PATH="${TARGET_FILE_LIST_PATH:-}"
REPORT_JSON_PATH="${REPORT_JSON_PATH:-$ROOT_DIR/.artifacts/sarif-category-report.json}"
REPORT_MD_PATH="${REPORT_MD_PATH:-$ROOT_DIR/.artifacts/sarif-category-report.md}"
SEP=$'\x1f'

if [ ! -d "$WORKFLOW_DIR" ]; then
  echo "::error::Workflow directory not found: $WORKFLOW_DIR"
  exit 1
fi

mkdir -p "$(dirname "$REPORT_JSON_PATH")"
mkdir -p "$(dirname "$REPORT_MD_PATH")"

declare -a workflow_files
declare -a categories
declare -A category_first_occurrence
declare -a findings

workflow_files=()
categories=()
findings=()

duplicate_count=0
invalid_count=0
scanned_count=0

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

add_finding() {
  local type="$1"
  local file="$2"
  local line="$3"
  local category="$4"
  local message="$5"
  findings+=("$type$SEP$file$SEP$line$SEP$category$SEP$message")
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

extract_category_value() {
  local line_text="$1"
  local raw_value
  local first_char
  local last_char
  raw_value="$(printf '%s\n' "$line_text" | sed -E 's/^[[:space:]]*category:[[:space:]]*//; s/[[:space:]]+#.*$//; s/[[:space:]]+$//')"

  if [ "${#raw_value}" -ge 2 ]; then
    first_char="${raw_value:0:1}"
    last_char="${raw_value: -1}"

    if { [ "$first_char" = '"' ] && [ "$last_char" = '"' ]; } ||
       { [ "$first_char" = "'" ] && [ "$last_char" = "'" ]; }; then
      raw_value="${raw_value:1:${#raw_value}-2}"
    fi
  fi

  printf '%s' "$raw_value"
}

is_valid_category() {
  local category="$1"

  # Allow GitHub expression categories if they use a scoped prefix.
  if [[ "$category" == *'${{'* ]]; then
    [[ "$category" =~ ^[a-z0-9][a-z0-9._-]*/ ]]
    return
  fi

  [[ "$category" =~ ^[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*$ ]]
}

write_reports() {
  local pass_status="$1"
  local generated_at
  generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  {
    echo "# SARIF Category Validation Report"
    echo
    echo "- Generated (UTC): $generated_at"
    echo "- Workflow files scanned: ${#workflow_files[@]}"
    echo "- Category entries scanned: $scanned_count"
    echo "- Duplicate categories: $duplicate_count"
    echo "- Invalid categories: $invalid_count"
    echo "- Pass: $pass_status"
    echo
    echo "Convention: workflow/scope using lowercase letters, numbers, dot, underscore, and dash."
    echo

    if [ "${#findings[@]}" -eq 0 ]; then
      echo "No findings."
    else
      echo "| Type | Location | Category | Message |"
      echo "| --- | --- | --- | --- |"
      for finding in "${findings[@]}"; do
        IFS="$SEP" read -r type file line category message <<< "$finding"
        echo "| $type | $file:$line | $category | $message |"
      done
    fi
  } > "$REPORT_MD_PATH"

  {
    echo "{"
    echo "  \"generatedAtUtc\": \"$(escape_json "$generated_at")\"," 
    echo "  \"workflowFilesScanned\": ${#workflow_files[@]},"
    echo "  \"categoryEntriesScanned\": $scanned_count,"
    echo "  \"duplicateCategories\": $duplicate_count,"
    echo "  \"invalidCategories\": $invalid_count,"
    echo "  \"pass\": $pass_status,"

    echo "  \"findings\": ["
    for i in "${!findings[@]}"; do
      IFS="$SEP" read -r type file line category message <<< "${findings[$i]}"
      if [ "$i" -gt 0 ]; then
        echo ","
      fi
      echo "    {"
      echo "      \"type\": \"$(escape_json "$type")\","
      echo "      \"file\": \"$(escape_json "$file")\","
      echo "      \"line\": $line,"
      echo "      \"category\": \"$(escape_json "$category")\","
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

echo "Checking SARIF category uniqueness and naming in $WORKFLOW_DIR"

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
    category_value="$(extract_category_value "$line_text")"

    if [ -z "$category_value" ]; then
      continue
    fi

    scanned_count=$((scanned_count + 1))
    file_rel="$(as_relative_path "$file")"

    if ! is_valid_category "$category_value"; then
      message="Category does not match convention workflow/scope"
      echo "::error file=$file_rel,line=$line_number::$message: $category_value"
      add_finding "invalid_category" "$file_rel" "$line_number" "$category_value" "$message"
      invalid_count=$((invalid_count + 1))
    fi

    if [ -n "${category_first_occurrence[$category_value]:-}" ]; then
      first_location="${category_first_occurrence[$category_value]}"
      message="Duplicate category. First seen at $first_location"
      echo "::error file=$file_rel,line=$line_number::$message"
      add_finding "duplicate_category" "$file_rel" "$line_number" "$category_value" "$message"
      duplicate_count=$((duplicate_count + 1))
    else
      category_first_occurrence[$category_value]="$file_rel:$line_number"
      categories+=("$category_value")
    fi
  done < <(grep -nE '^[[:space:]]*category:[[:space:]]*' "$file" || true)
done

pass_status="true"
if [ "$duplicate_count" -gt 0 ] || [ "$invalid_count" -gt 0 ]; then
  pass_status="false"
fi

write_reports "$pass_status"
echo "Reports written to: $REPORT_JSON_PATH and $REPORT_MD_PATH"

if [ "$pass_status" = "false" ]; then
  exit 1
fi

echo "All SARIF categories are unique and match naming convention."
