# React 전환 실험 브랜치

임시 합성 데이터 테스트는 [DEMO_DATA_KO.md](DEMO_DATA_KO.md)를 참고한다.
`python ml/make_demo.py` 후 개발 화면에서 Load synthetic demo를 누른다.
실제 Supabase 결과를 수정하지 않으며 운영 빌드에는 제공하지 않는다.

추가 모델 연결: 홈/상단의 Model results가 전용 결과 뷰어를 연다.
Python 추론·PNG 내보내기와 게시 방법은 [ml/README_KO.md](ml/README_KO.md)를 따른다.
입력 데이터와 실제 학습된 체크포인트가 없어서 실제 예측 생성·업로드는 아직 하지 않았다.

## 브랜치와 배포

- 기존 운영 코드: `main`
- 실험 코드: `feature/react-vite-migration`
- 기준 커밋: `4edbc4f` (Supabase PNG 조회가 확인된 기존 코드)
- 이 작업에서 main 병합, Production 승격, DB/버킷 수정은 하지 않는다.
- Vercel Production Branch가 main이면 기존 운영 사이트는 유지된다.
- push 후 Git 연결이 활성화돼 있으면 별도 Preview 배포가 생성된다.
  배포 생성·성공 상태는 Vercel Deployments에서 확인한다.
- Preview API에는 Vercel **Preview 환경**에도 기존 세 환경변수가 필요하다.
  Production에만 있다면 Preview에 따로 설정하고 Preview만 재배포한다.
  Production Branch나 프로젝트 전체의 공통 빌드 설정은 바꾸지 않는다.

## 구조

```text
src/main.jsx                      React + CSS 진입점
src/App.jsx                       UI 구성·지도 생명주기
src/components/Topbar.jsx          상단 UI
src/components/GlobeScene.jsx      지구본·별자리·컨트롤
src/components/ComparisonScene.jsx Before / After 패널
src/components/LocalMap.jsx        상세 지도 패널
src/components/AboutDialog.jsx     설명 모달
src/components/ModelResults.jsx    React 상태 기반 모델 PNG 목록
src/components/ConnectionStatus.jsx React 상태 기반 Storage 확인
src/lib/api.js                    공통 API 요청·취소·시간 제한
app.js                            MapLibre 컨트롤러: start / destroy
lib/apiRouter.js                  개발/preview API 어댑터
vite.config.js                    React 빌드·API 미들웨어
api/*.js                          기존 Vercel 서버 함수
```

React가 JSX 화면 구조와 모델 결과/연결 확인 상태를 관리한다.
기존 지리·비교 조작은 지도 컨트롤러에 유지하는 단계적 전환이다.
모든 지도 상태를 React useState로 다시 구현한 것은 아니다.
마운트 시 start, 해제 시 destroy로 지도와 이벤트를 정리한다.
비교 화면은 JSX에서 지구본 내부에 배치해 실행 중 DOM 재배치를 없앴다.
모델 API·실험 상태·빈 결과·서명 URL은 기존 방식 그대로다.
결과 목록 갱신 실패 시 기존 결과를 유지하고 언마운트 시 요청을 취소한다.
Supabase 프로젝트·버킷·비밀 키·기존 API 함수는 그대로 사용한다.

## 실행

Windows cmd, Node.js 22.16 이상:

```cmd
git switch feature/react-vite-migration
npm ci
npm run dev
```

http://127.0.0.1:3000 접속. 기존 서버가 포트를 쓰면 해당 터미널에서 Ctrl+C.
브랜치 전환 시 .env.local은 그대로 남아 기존 Supabase 설정을 사용한다.
서버 비밀 키를 VITE_ 변수에 넣지 않는다. 브라우저에 공개된다.

```cmd
npm test
npm run build
npm run preview
```

빌드 미리보기는 http://127.0.0.1:4173. 개발·preview 서버 모두 API를 연결한다.
운영에서는 vercel.json의 Vite 빌드(npm run build, dist)와 api/ 함수를 사용한다.
CSS/JS/별 배경 SVG는 빌드에 포함된다. 실제 SAR overlay 설정이 있으면 지정된
PNG와 설정만 복사한다. 원본 자료·비밀 파일 전체를 웹 배포에 복사하지 않는다.

## 기존 방식으로 돌아가기

서버를 Ctrl+C로 종료한 뒤 작업 트리가 깨끗한 상태에서:

```cmd
git switch main
npm ci
npm run dev
```

main 코드와 main 의존성으로 돌아간다. 실험 브랜치는 보존된다.
다시 React를 실행할 때는 실험 브랜치로 switch 후 npm ci를 실행한다.
미커밋 수정이 있으면 먼저 보존한다. reset --hard나 강제 push는 필요 없다.

## 채택 여부 결정

Preview에서 지도 회전·확대, 마커 고정, NASA 비교, 홈 복귀,
Storage 연결, 실제 모델 PNG 표시를 확인한다. 실제 모델 파일은 별도 검증 필요.
마음에 들면 GitHub에서 실험 브랜치 → main Pull Request를 만들어 검토·병합한다.
그 전에는 main에 merge하거나 Preview를 Production으로 promote하지 않는다.

## 검증 범위

- React/Vite production build 성공.
- 기존 NASA/지도 회귀 테스트 및 새 Vite HTTP·React 서버 렌더링 통합 테스트.
- 환경파일 차단 및 PNG manifest/서명 URL 테스트.
- 전체 테스트 16개 통과(실제 로컬 HTTP 및 React 서버 렌더링 포함).
- 브라우저에서 지구본·별 배경, 모달 열기/닫기, 상세 지도 이동·홈 복귀 확인.
- 지도 드래그 뒤 선택 좌표 유지, 실제 Supabase 연결 성공 및 빈 결과 안내 확인.
- 실제 모델 PNG 표시와 NASA 원격 이미지의 완전한 로딩은 별도 확인 필요.
- 실서버 자료 수정·가짜 모델 결과 업로드는 하지 않음.

해커톤 인수인계 문서는 HACKATHON_HANDOFF_KO.md.
이 브랜치에서는 해당 문서 상단의 React 전환 안내와 이 파일을 우선한다.
