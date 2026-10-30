#!/usr/bin/env bash
# 외부 공유 전 점검: 저장소·히스토리·빌드 결과에 Groq API Key 모양의 값이 없는지, .env가 추적되지 않는지 확인한다.
# 사용: npm run build 후 bash scripts/check-secrets.sh  (문제가 있으면 1로 종료)
set -u
cd "$(dirname "$0")/.."
PATTERN='gsk_[A-Za-z0-9]{20,}'
fail=0

echo "1) 추적 중인 파일"
git grep -nE "$PATTERN" -- . ':!scripts/check-secrets.sh' && fail=1 || echo "   없음"

echo "2) 전체 Git 히스토리"
if git rev-list --all | xargs -I{} git grep -lE "$PATTERN" {} -- . ':!scripts/check-secrets.sh' 2>/dev/null | grep -q .; then echo "   발견!"; fail=1; else echo "   없음"; fi

echo "3) 빌드 결과(dist/)"
if [ -d dist ]; then grep -rEl "$PATTERN" dist && fail=1 || echo "   없음"; else echo "   dist/ 없음(먼저 npm run build)"; fi

echo "4) .env 추적 여부"
if git ls-files --error-unmatch .env >/dev/null 2>&1; then echo "   .env가 추적되고 있어요!"; fail=1; else echo "   추적 안 됨"; fi

echo "5) 프런트 코드가 키를 서버 밖으로 받는지(응답에 apiKey 포함 여부)"
grep -nE "apiKey" server/index.ts | grep -E "res\.(json|send)" && fail=1 || echo "   응답에 apiKey 없음"

echo "6) 프런트 소스가 Groq·서버 비밀값에 접근하지 않는지(src/)"
grep -rnE "api\.groq\.com|GROQ_API_KEY|VITE_GROQ|SERVICE_ROLE|OPS_TOKEN" src && fail=1 || echo "   없음"

echo "7) 빌드 결과에 비밀 변수명·Groq 주소·JWT 형태 값이 없는지(dist/)"
if [ -d dist ]; then grep -rEl "GROQ_API_KEY|api\.groq\.com|SUPABASE_SERVICE_ROLE_KEY|OPS_TOKEN|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}\." dist && fail=1 || echo "   없음"; else echo "   dist/ 없음"; fi

echo "8) 설정 파일의 VITE_ 변수에 비밀 이름이 없는지(.env.example·render*.yaml)"
grep -nE "VITE_[A-Z_]*(SECRET|SERVICE|GROQ|TOKEN|PRIVATE)" .env.example render*.yaml 2>/dev/null && fail=1 || echo "   없음"

echo "9) .env.example에 실제 값처럼 보이는 것이 없는지"
grep -nE "(gsk_|phc_|sb_secret|eyJ)[A-Za-z0-9_-]{8,}" .env.example 2>/dev/null && fail=1 || echo "   없음"

[ "$fail" -eq 0 ] && echo "통과" || echo "실패: 위 항목을 확인하세요"
exit "$fail"
