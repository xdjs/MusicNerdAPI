#!/bin/sh
# Uses existing Vercel preview app credentials; no cleanup before log backup verification.
set -eu
pnpm build
node scripts/discovery1660/build.mjs
result=0
node .next/discovery1660.mjs || result=$?
if [ -f discovery1660-results/evidence.json ]; then
  echo DISCOVERY1660_EVIDENCE_BEGIN
  cat discovery1660-results/evidence.json
  echo
  echo DISCOVERY1660_EVIDENCE_END
  echo DISCOVERY1660_SHA256_BEGIN
  cat discovery1660-results/evidence.sha256
  echo
  echo DISCOVERY1660_SHA256_END
fi
exit "$result"
