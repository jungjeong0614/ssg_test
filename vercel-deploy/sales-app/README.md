# 기존 매출 비교 대시보드

이 앱은 루트 `README.md`의 Vercel 배포 안내에 따라 배포합니다. 로컬 개발은 `npm run dev`, 빌드는 `npm run build`입니다.

배포 빌드 입력은 `fixtures/educational`의 해시 검증된 교육용 JSON뿐입니다. A~E 업무 원본을 사용하지 않습니다. 날씨는 `/api/weather` 서버 함수가 처리하고 `OPENWEATHER_API_KEY`는 서버 환경 변수에서만 읽습니다. 누락 또는 실패 시 화면은 교육용 예제임을 표시합니다.
