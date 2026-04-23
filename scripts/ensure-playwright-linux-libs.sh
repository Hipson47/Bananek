#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

if [[ "$(uname -s)" != "Linux" ]]; then
  exit 0
fi

LOCAL_LIB_DIR=".playwright-libs/root/usr/lib/x86_64-linux-gnu"

if ldconfig -p 2>/dev/null | grep -q "libnspr4.so" \
  && ldconfig -p 2>/dev/null | grep -q "libnss3.so" \
  && (ldconfig -p 2>/dev/null | grep -q "libasound.so.2" || ldconfig -p 2>/dev/null | grep -q "libasound.so"); then
  exit 0
fi

if [[ -f "${LOCAL_LIB_DIR}/libnspr4.so" && -f "${LOCAL_LIB_DIR}/libnss3.so" ]]; then
  exit 0
fi

mkdir -p .playwright-libs/debs .playwright-libs/root
rm -f .playwright-libs/debs/*.deb

cd .playwright-libs/debs

if apt-cache policy libasound2t64 >/dev/null 2>&1; then
  apt download libnspr4 libnss3 libasound2t64 >/dev/null
else
  apt download libnspr4 libnss3 libasound2 >/dev/null
fi

for deb in ./*.deb; do
  dpkg-deb -x "$deb" ../root
done
