# Vercel 배포 준비본

기존 `sales-app` 대시보드를 Vercel에 올리기 위한 독립 폴더입니다. 앱을 새로 만들지 않았습니다. 이 폴더에는 앱 코드, lockfile, Vercel 서버 함수, 검증된 교육용 가상 JSON만 있습니다. 실습 원본(A~E), 결과 파일, 로컬 환경 파일은 포함하지 않았습니다.

## 폴더와 빌드

- `sales-app/src`, `sales-app/index.html`: 기존 Vite 대시보드
- `sales-app/fixtures/educational`: manifest 해시 검증을 거치는 가상 매출·운영·날씨 자료
- `sales-app/api/weather.mjs`: Vercel 서버 함수 진입점
- `sales-app/server/weather.js`: 서버에서만 `OPENWEATHER_API_KEY`를 읽고 OpenWeather를 호출. 브라우저는 `/api/weather`만 요청
- `sales-app/vercel.json`: 앱 루트 기준 설치·빌드·API 함수 설정 및 SPA rewrite
- 설치: `npm ci --no-audit --no-fund`
- 빌드: `npm run build`
- Output Directory: `dist`

Vercel 프로젝트의 **Root Directory는 `sales-app`**으로 설정합니다. 그러면 Vercel이 `sales-app/package.json`, `sales-app/package-lock.json`, `sales-app/vercel.json`, `sales-app/api/weather.mjs`를 같은 프로젝트 루트에서 사용합니다. 이 루트에서는 Install Command가 `npm ci --no-audit --no-fund`입니다. `npm --prefix sales-app ci ...`는 사용하지 마세요. 하위 prefix가 중복되어 lockfile을 찾지 못할 수 있습니다.

빌드 전 교육용 fixture로 `sales-app/public/data`와 `sales-app/server/data`를 만듭니다. 두 생성 디렉터리는 Git에서 무시됩니다. 배포 폴더의 입력 스크립트는 바깥 실습 원본 폴더를 탐색하지 않습니다.

## 직접 배포 순서

1. 이 `vercel-deploy` 폴더만 ZIP으로 업로드하거나 이 폴더만 Git 저장소에 올립니다. 환경 파일과 원본 자료는 업로드하지 않습니다.
2. Vercel에서 **Add New → Project → Import**로 연결 GitHub 저장소를 불러옵니다. Root Directory는 `sales-app`으로 설정합니다. 프로젝트 이름과 공개 범위를 검토합니다.
3. 프로젝트의 Settings에서 팀 계정·요금제·사용량 한도를 확인합니다. 무료 또는 유료 요금제의 한도와 과금 조건을 확인한 뒤 진행합니다.
4. Settings → Environment Variables에서 `OPENWEATHER_API_KEY`를 만들고 OpenWeather 키를 값으로 입력합니다. 값은 공유 문서·저장소에 적지 말고 필요한 환경(Preview/Production)만 선택합니다. 이 준비본의 `.env.example`은 빈 자리표시자입니다.
5. Import 설정에서 Framework Preset은 Other(또는 자동 감지), Install Command는 `npm ci --no-audit --no-fund`, Build Command는 `npm run build`, Output Directory는 `dist`로 확인합니다. `sales-app/vercel.json`이 같은 값을 제공합니다.
6. 팀의 접근 범위(프로젝트 멤버, 배포 접근, 공개 도메인 및 미리보기 보호)를 확인하고, 공개 데이터가 교육용 가상 자료만인지 살펴본 뒤 **Deploy**를 직접 누릅니다.
7. 배포 후 `/api/weather`가 `mode: live`이면 실시간 연결입니다. 키가 없거나 공급자 요청이 실패하면 `mode: sample`과 사유가 표시되고 교육용 예제로 전환됩니다.

## 배포 전 점검

- 폴더 안에 `.env.local`, XLSX/CSV 업무 원본, 빌드 결과가 없습니다.
- `.env.example`에는 `OPENWEATHER_API_KEY=` 빈 값만 있습니다.
- `.gitignore`는 `.env*`(단, `.env.example` 제외), `node_modules`, `dist`, `.vercel`, 생성 데이터를 제외합니다.
- 서버 응답에는 키가 포함되지 않습니다. 키를 `VITE_` 접두사 변수로 만들지 마세요.
- 키 노출 검사는 코드/브라우저 번들/환경 파일/Git 추적 목록에서 별도로 수행하고, 결과는 루트 `KEY-EXPOSURE-REPORT.md`에 기록했습니다.
