# 배포 준비 키 노출 점검

- 검사 대상: `vercel-deploy` 코드, 설정, 교육용 fixture, ZIP 업로드 파일.
- 실제 비밀 값 패턴: **0건**. 서버 코드에는 `OPENWEATHER_API_KEY` 이름만 있으며 키 값은 없습니다.
- 브라우저 번들 내보내기 검사: 빌드 산출물 생성 전에 Windows 실행 제한으로 중단되어 완료하지 못했습니다. 정적 코드에는 키 값이 없고 브라우저는 `/api/weather`만 호출하도록 구성되어 있습니다.
- ZIP 검사: 38개 항목. `.env.local`, A~E 원본, XLSX/CSV, `node_modules`, `dist` **0건**.
- `vercel-deploy/.gitignore`: 환경 파일, 의존성, 빌드 출력, 생성 데이터 제외 규칙 확인.
- 루트 Git 추적 검사: 비밀 환경 파일 및 XLSX/CSV 업무 원본은 추적 파일에 없습니다. `.env.example`은 빈 값이며 `results/.gitkeep`은 빈 디렉터리 표식입니다.
- `vercel-deploy/.env.example`에는 `OPENWEATHER_API_KEY=` 빈 값만 있습니다.

교육용 자료 생성은 매출 480행, 운영 72행 단계까지 통과했습니다. 최종 Vite 빌드는 esbuild 하위 프로세스 시작 시 `spawn EPERM`으로 실패했습니다. ZIP 업로드 후 Vercel Linux에서 자동 빌드를 확인하세요.