# 매출 비교 앱 (1단계)

저장소 루트에서 `npm --prefix sales-app install` 후 `npm run dev`로 실행합니다.
주소는 http://127.0.0.1:5173 입니다. `npm run build`로 빌드합니다.

시작/빌드 시 로컬 원본이 모두 있으면 세 XLSX와 04 보고양식을 읽습니다. 원본이 전부 없는 Git/Vercel 환경에서는 `fixtures/educational`의 검증된 교육용 복사본을 사용합니다. 일부 원본만 있으면 누락 오류를 표시합니다. SHA256 검증에 실패한 복사본도 빌드하지 않습니다. 원본은 읽기 전용이며 public/data와 dist는 생성물로 Git에서 제외합니다.

점포·채널·기준주·검색어는 요약, 점포 비교, 집계표, 상세 기록과 XLSX 보고서에 함께 적용됩니다. 업로드는 기존 자료에 추가하되 record_id 중복은 첫 기록만 계산합니다. 유효하지 않은 업로드는 기존 자료를 유지합니다.

메모는 record_id별로 현재 브라우저에 저장되며 XLSX 보고서에 포함됩니다. 보고서 저장 버튼은 브라우저의 다운로드 위치에 새 파일을 저장합니다. 원본을 덮어쓰지 않습니다. 목표가 0이거나 없으면 달성률은 화면에 —, XLSX에는 빈칸입니다.

검사 스크립트와 검사 결과는 각각 tests 및 ../results에 있습니다. 본 앱은 매출·운영 기능을 제공하는 로컬 앱입니다.

## 운영 탭과 서버 날씨

운영 탭은 B의 07 브리프와 C의 08 준비표를 읽어 생성합니다. 기준일은 2026-10-20이며 완료·취소를 제외합니다. 담당 역할과 다섯 마감 분류로 필터링할 수 있습니다. 확인 체크와 메모는 task_id별로 현재 브라우저의 localStorage에 저장됩니다. 체크는 원본 상태나 분류를 바꾸지 않습니다.

저장소 루트의 `.env.local`에 아래 항목의 `=` 뒤에 발급받은 키를 직접 넣고 서버를 다시 시작하세요. 키는 이 파일 또는 서버 환경 변수 `OPENWEATHER_API_KEY`로만 제공합니다. `.env.example`에는 빈 값만 기록합니다.

```dotenv
OPENWEATHER_API_KEY=
```

브라우저는 `/api/weather`만 호출합니다. Vite 개발 서버와 preview 서버의 서버 미들웨어가 OpenWeather 현재 날씨(`/data/2.5/weather`) 및 5일·3시간 예보(`/data/2.5/forecast`)를 HTTPS로 호출합니다. 위치는 D 예제의 서울 중구 참고 좌표이며 예제A점의 실제 위치가 아닙니다. metric 단위와 한국어 설명을 사용합니다. 3시간 예보를 현지 날짜별로 묶어 첫 5일을 표시하며 일부 날짜는 부분 시간대입니다.

성공 응답은 서버 프로세스 메모리에 10분 캐시합니다. 동시 요청을 합치며 공급자 응답 및 JSON 본문 처리에 총 5초 제한을 둡니다. 키 누락·인증 오류·요청 제한·네트워크 오류·시간 초과·응답 형식 오류 시 D의 11 예제로 전환하고 사유를 표시합니다. 서버 자체 연결이 실패하면 로컬 예제 복사본을 사용합니다. 예제 원래 날짜·시각과 현재 조회 시각을 구분합니다. 실패 응답은 성공 캐시로 저장하지 않습니다.

실제 연결 여부는 응답 `mode=live`로 확인합니다. `mode=sample`은 실제 연결 성공이 아닙니다. 모의 검사는 외부 공급자 연결을 증명하지 않습니다. 재검사: `node sales-app/tests/operations-weather.mjs` (저장소 루트에서 서버 실행 중).

로컬은 Vite/preview 미들웨어, Vercel은 저장소 루트의 `api/weather.mjs` 서버 함수로 `/api/weather`를 제공합니다. `vercel.json`은 API를 SPA 재작성에서 제외합니다.

## Vercel 설정

Root Directory는 저장소 루트(`.`), Install Command는 `npm --prefix sales-app ci --no-audit --no-fund`, Build Command는 `npm run build`, Output Directory는 `sales-app/dist`입니다. 저장소의 vercel.json에 선언되어 있습니다. Vercel 환경 변수 설정에 OPENWEATHER_API_KEY를 비밀 값으로 등록해야 실제 날씨가 표시됩니다. 로컬 .env.local 및 Sites 비밀 설정은 Vercel로 자동 복사되지 않습니다. 키가 없으면 이유와 예제 날씨를 표시합니다.

원본 A~E 폴더는 계속 Git에서 제외합니다. fixtures/educational은 데이터 안내에서 가상 데이터임을 확인한 배포 전용 JSON이며 메모나 고객·개인 정보·키를 포함하지 않습니다. 원본 없는 빌드 재현 검사: `node sales-app/tests/vercel-build.mjs`.

공급자 문서: https://openweathermap.org/api/current , https://openweathermap.org/api/forecast5

## 준비 항목 카드 보드

운영 탭의 다섯 마감 분류는 공통 점검 기준일·담당 역할 필터로 갱신됩니다. `마케팅 담당만 보기`는 미완료 7개 항목을 모읍니다. 카드를 누르면 task_id, 마감일, 확인사항, 원본 상태, 개인 확인 체크와 메모를 큰 상세창에서 확인할 수 있습니다. 기존 브라우저 저장 키와 task_id를 유지합니다.

브리프에서 읽은 행사 기간(2026-10-23~2026-11-01)에 해당하고 강수확률이 60% 이상인 예보는 EV071 우천 시 반입 동선 확정 항목으로 연결합니다. `서버 예보`와 `교육용 예제 10/23 · 80%`를 별도로 선택하며 실제/예제 출처와 시각을 표시합니다. 담당 필터가 마케팅이어도 우천 경고에서 행사 운영 담당의 EV071을 열 수 있습니다. 강수확률은 공급자의 3시간 구간 중 날짜별 최댓값이며 예보가 없는 날짜는 판단하지 않습니다.

카드·우천 규칙 검사: `node sales-app/tests/board-rain.mjs`.
