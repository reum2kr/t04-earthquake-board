# T04 — 오늘의 진짜 정보판 (지진 / USGS)

지난 24시간 내 전 세계 최대 규모 지진을 USGS 공개 GeoJSON에서 조회해 보여줍니다. 비밀키 불필요.

## 배포 방법 (reum2kr/저장소명 기준)

1. 이 폴더 전체를 새 GitHub 저장소에 push
   ```
   git init
   git add .
   git commit -m "init: T04 earthquake board"
   git branch -M main
   git remote add origin https://github.com/reum2kr/<저장소명>.git
   git push -u origin main
   ```
2. 저장소 Settings → Pages → Source를 `main` 브랜치 `/ (root)`로 설정 → 공개 URL 생성됨
3. Settings → Actions → General → Workflow permissions을 **"Read and write permissions"**으로 변경
   (`.github/workflows/daily-fetch.yml`이 데이터를 커밋하려면 필요)
4. Actions 탭 → "T04 daily earthquake fetch" → **Run workflow**로 최초 1회 수동 실행
   → `data/daily-readings.json`에 오늘 KST 날짜 기록 1건 생성됨
5. **다른 실제 KST 날짜에** 자동 스케줄(매일 UTC 00:10, 12:10) 또는 수동 재실행으로 두 번째 기록 확보
   → `data/daily-readings.json`에 서로 다른 날짜 2건이 쌓이면 과제4 카드5(C22~C24) 충족

## 제출 필드

- **결과물 주소**: `https://reum2kr.github.io/<저장소명>/`
- **소스 주소**: `https://github.com/reum2kr/<저장소명>/commit/<커밋해시>`
  (T04-C35: 40자리 또는 64자리 소문자 16진수 commit 해시 포함 필수)

## 구조

- `index.html` / `app.js` / `style.css` — 공개 심사 화면 (① 실시간 조회, ② 일별기록, ③ 합성실패 데모)
- `engine.js` — 정규화/저장/상태 전이 공용 엔진 (공식 `adapter-reset.example.js` 계약 이식, fixture expected값 전수 검증 완료)
- `scripts/fetch-and-record.mjs` — GitHub Actions가 매일 실행하는 실제 조회·커밋 스크립트
- `data/daily-readings.json` — 실제 일별 정규화 기록 (Actions가 갱신)
- `data/receipts.json` — 봉인 영수증(canonical_kind: t04_day) — 제출정보.json 작성 시 이 파일 참고
- `fixtures/` — 과제 공식 제공 fixture 9종 원본 그대로 사용
