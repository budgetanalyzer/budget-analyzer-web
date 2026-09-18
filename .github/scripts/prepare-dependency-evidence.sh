#!/usr/bin/env bash

set -euo pipefail

if [[ "$#" -lt 3 ]]; then
  echo "Usage: $0 OUTPUT_ARCHIVE LABEL PATH..." >&2
  exit 2
fi

output_archive="$1"
label="$2"
shift 2

if [[ "${output_archive}" != *.tar.gz ]] \
  || [[ "${output_archive}" == /* ]] \
  || [[ "/${output_archive}/" == *'/../'* ]]; then
  echo "The evidence archive must be a workspace-relative .tar.gz path: ${output_archive}" >&2
  exit 2
fi

# Keep one MiB of headroom beneath the former 25 MiB retained-size threshold.
max_bytes=25165824

mkdir -p "$(dirname "${output_archive}")"
rm -f "${output_archive}"

runner_temp="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
path_list="$(mktemp "${runner_temp%/}/dependency-automation-paths.XXXXXX")"
tar_file="$(mktemp "${runner_temp%/}/dependency-automation-evidence.XXXXXX.tar")"
trap 'rm -f "${path_list}" "${tar_file}"' EXIT

total_source_bytes=0
for candidate in "$@"; do
  if [[ "${candidate}" == /* ]] || [[ "/${candidate}/" == *'/../'* ]]; then
    echo "Evidence paths must stay within the workspace: ${candidate}" >&2
    exit 2
  fi

  if [[ ! -e "${candidate}" && ! -L "${candidate}" ]]; then
    echo "Evidence path does not exist: ${candidate}" >&2
    exit 1
  fi

  candidate_bytes="$(du --bytes --summarize --apparent-size -- "${candidate}" | cut -f1)"
  total_source_bytes=$((total_source_bytes + candidate_bytes))
  printf '%s\n' "${candidate}" >> "${path_list}"
done

tar --create --file "${tar_file}" --verbatim-files-from --files-from "${path_list}"
uncompressed_bytes="$(stat --format='%s' "${tar_file}")"
gzip --best --stdout "${tar_file}" > "${output_archive}"
compressed_bytes="$(stat --format='%s' "${output_archive}")"

within_cap=true
if [[ "${compressed_bytes}" -gt "${max_bytes}" ]]; then
  within_cap=false
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    printf 'archive_path=%s\n' "${output_archive}"
    printf 'source_bytes=%s\n' "${total_source_bytes}"
    printf 'uncompressed_bytes=%s\n' "${uncompressed_bytes}"
    printf 'compressed_bytes=%s\n' "${compressed_bytes}"
    printf 'within_cap=%s\n' "${within_cap}"
  } >> "${GITHUB_OUTPUT}"
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    printf '## %s evidence measurement\n\n' "${label}"
    echo '| Source bytes | Tar bytes | Compressed bytes | Cap bytes | Within cap |'
    echo '| ---: | ---: | ---: | ---: | --- |'
    printf '| %s | %s | %s | %s | %s |\n' \
      "${total_source_bytes}" "${uncompressed_bytes}" "${compressed_bytes}" "${max_bytes}" "${within_cap}"
    echo
    echo 'The archive contains only the explicitly supplied workspace-relative paths.'
  } >> "${GITHUB_STEP_SUMMARY}"
fi

if [[ "${within_cap}" != true ]]; then
  rm -f "${output_archive}"
  echo "The compressed ${label} evidence exceeds the ${max_bytes}-byte cap." >&2
  exit 1
fi
