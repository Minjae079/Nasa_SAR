# SARSCOPE 현장 실행·재구축 안내 및 GPT 인수인계 프롬프트

> **최신 변경: React 실험 브랜치 추가**
>
> 기존 vanilla 사이트는 `main`, React + Vite 실험은
> `feature/react-vite-migration` 브랜치다. 이 문서를 GPT에게 줄 때
> [REACT_BRANCH.md](REACT_BRANCH.md)도 함께 읽히고 현재 브랜치를 먼저 확인한다.
> 아래의 buildless/Other 설정은 main 기준이다. 실험 브랜치는 Vite,
> `npm run build`, output `dist`를 사용한다. React UI는 `src/`, 지도 컨트롤러는
> `app.js`, 로컬 API 어댑터는 `lib/apiRouter.js`에 있다.
> 루트 `database-status.js`, `model-results.js`는 React 컴포넌트로 대체됐다.
> `npm run dev` 명령과 Supabase/Vercel API URL·비밀 환경변수는 그대로다.
> 실험 브랜치만 push하고 main 병합과 Production 승격은 검토 후 결정한다.
> 현재 단계는 React UI + 기존 지도 컨트롤러를 재사용하는 점진적 전환이다.
> React 브랜치는 테스트 16개와 production 빌드, 실제 브라우저에서 지도·모달·
> Storage 연결·빈 결과 표시를 확인했다. 실제 모델 PNG 표시는 아직 검증 전이다.

작성 기준: 2026-11-13, 현장 사용 예정일: 2026-11-14.
이 문서에는 비밀번호와 비밀 키가 없다. 아래 설정값의 비밀 키는 본인이 직접 입력한다.

## 0. 현장에서 가장 먼저 할 일

1. 기존 코드를 사용할 수 있으면 **1번 프롬프트**를 새 GPT/Codex에 붙여넣는다.
2. 같은 PC라면 **3-A**, 다른 PC라면 **3-B** 명령을 실행한다.
3. **4번의 환경변수**를 설정하고 로컬 연결을 확인한다.
4. 이미 배포된 사이트를 유지한다면 새 프로젝트를 만들지 말고 **5번**에서 기존 배포를 확인한다.
5. 모델 결과가 준비되면 **6번**을 진행한다.

현장에 간다고 기존 Supabase/Vercel 서버를 다시 만들 필요는 없다.
같은 계정·프로젝트를 사용할 수 있으면 기존 서버와 파일을 재사용한다.
행사 규정상 신규 구현이 필요한 경우에는 규정에 맞게 **2번 프롬프트**를 사용한다.

## 1. 새 GPT/Codex에 처음 입력할 프롬프트 — 기존 프로젝트 이어가기

아래 블록 전체를 복사해서 입력한다. Codex에는 프로젝트 폴더를 열어 주고,
일반 ChatGPT를 사용한다면 저장소 또는 필요한 소스 파일도 제공한다.
이전 대화를 기억한다고 가정하지 말 것.

```text
너는 NASA 해커톤 SARSCOPE 프로젝트의 개발을 이어받는 개발자야.
아래 상황과 현재 저장소를 먼저 확인하고, 기존 구현을 최대한 재사용해줘.

[프로젝트]
- 이름: SARSCOPE / NASA NISAR 위성영상 탐색·비교 및 모델 출력 시각화
- GitHub: https://github.com/Minjae079/Nasa_SAR.git
- 운영 사이트: https://nasasar.vercel.app
- 기존 Windows 작업 폴더: D:\Nasa_hackerton\SARSCOPE_NISAR_Compare_Vercel
- 현재 폴더가 다르면 실제 폴더를 기준으로 진행해.
- Windows에서는 Command Prompt(cmd) 사용을 우선해.
- Node.js 22.16 이상, npm, Git을 사용해.

[최종적으로 합의한 서비스 구조]
입력 위성자료 → 별도 Python 환경에서 전처리·모델 실행 → 결과 PNG 생성
→ Supabase Storage에 PNG와 manifest.json 저장
→ Vercel API가 목록을 읽고 이미지의 임시 URL 발급
→ 브라우저가 PNG를 직접 불러와 표시.
현재는 모델을 사전 실행해 저장된 결과를 보여주는 방식이야.
Vercel에서 대용량 SAR 전처리나 GPU 모델 실행을 할 필요는 없어.

[Supabase]
- 프로젝트 ID: jywbvxyyumznolgultci
- 프로젝트 URL: https://jywbvxyyumznolgultci.supabase.co
- 대시보드: https://supabase.com/dashboard/project/jywbvxyyumznolgultci
- Storage 버킷: sarscope-data, PRIVATE 유지
- 결과 목록 위치: results/manifest.json
- 결과 PNG 위치: results/<run-id>/<filename>.png
- 초기 manifest는 {"version":1,"results":[]} 상태로 업로드 완료했어.
- scenes, analyses, analysis_assets 테이블과 PostGIS는 이미 만들었지만,
  최종 PNG 조회 흐름에서는 SQL 테이블을 사용하지 않아.
- DB를 새로 만들거나 기존 테이블·버킷을 삭제하지 마.
- Neon, RDS 등 다른 DB를 추가할 필요 없어.

[환경변수]
SUPABASE_URL=https://jywbvxyyumznolgultci.supabase.co
SUPABASE_SECRET_KEY=사용자가 직접 보관한 sb_secret_ 서버용 키
SARSCOPE_PUBLIC_ANALYSES=true
- 로컬 .env.local과 Vercel 환경변수에 설정하는 구조야.
- .env.local과 비밀 키를 출력·커밋하거나 브라우저 코드에 넣지 마.
- 키를 채팅에 붙여넣으라고 요청하지 말고 로컬/대시보드 입력을 안내해.
- SARSCOPE_PUBLIC_ANALYSES는 예전 변수 이름이지만 현재 PNG 공개를 제어해.
- published:true인 manifest 항목만 사이트 방문자에게 보여줘.

[현재 코드]
- index.html, app.js, styles.css, responsive.css: 기본 프론트
- compare.css: Before/After 비교 화면
- map.css: 연속 지구본/지도 화면
- sky.css, assets/sky/: 실제 별 좌표 기반 배경과 라이선스
- MapLibre GL JS 한 개로 지구본과 local map을 렌더링해.
- 지구 시작 확대값은 app.js의 START.zoom을 확인해.
- 초록색 마크는 선택한 지리 좌표에 고정되며 지도 드래그로 바뀌면 안 돼.
- 홈/사진 비교 화면에는 별자리 배경을 유지해.
- api/coverage.js와 lib/sarCatalog.js: NASA ASF 관측 검색과 날짜 매칭
- api/preview.js: 기존 NASA 이미지 프록시
- lib/supabaseServer.js: 서버 전용 Supabase SDK와 오류 응답
- api/database-status.js: SQL 조회 없이 비공개 버킷 연결 확인
- api/model-results.js: 고정 manifest 다운로드, 검증, PNG URL 10분 서명
- api/analyses.js: model-results API의 호환 별칭
- lib/modelManifest.js: manifest 검증·게시 항목 필터
- model-results.js: How it works 안에 PNG 결과 카드 표시
- database-status.js: 연결 확인 버튼
- dev-server.mjs: 로컬 API 서버, .env.local 로딩
- lib/staticFiles.js: 정적 파일 허용 목록. 새 프론트 파일을 추가하면 여기에도 반영해.
- supabase/CONNECT.md: 현재 PNG 전용 설정 안내
- supabase/results-manifest.json: 초기 빈 목록 업로드용 파일
- test/: 기존 NASA 기능 및 Storage API의 모의 응답 테스트
- package-lock.json에 맞춰 npm ci로 설치해.

[확인된 상태]
- 당시 전체 테스트 15개 통과.
- 로컬과 https://nasasar.vercel.app/api/model-results에서
  results:[], state:"empty" 응답을 확인했어.
- 이 응답은 manifest를 읽는 데 성공했다는 뜻이야.
- 실제 모델 PNG는 아직 전달받지 않아 이미지 표시까지 실증하지 못했어.
- 새 세션에서는 기존 성공을 현재 성공으로 단정하지 말고 다시 확인해.

[남은 작업]
- 실제 PNG·관측 날짜·모델 버전·설명을 받아 업로드하고 manifest에 등록.
- 현재 모델 결과는 How it works → Load / refresh results 안에서 보여줘.
- 기존 Before/After 비교 패널을 모델 출력으로 교체하거나 지도에 겹치는
  기능은 아직 구현하지 않았어. 필요하면 기존 NASA 비교 흐름과 구분해 추가해.
- 일반 PNG 카드는 좌표 없이 표시 가능하지만 지도 오버레이에는 실제 좌표계,
  범위·모서리 좌표와 적절한 재투영이 필요해. 좌표를 임의로 만들지 마.
- 임시 이미지 URL은 10분 후 만료되므로 결과 목록 재조회로 갱신해.
- 관측 당시 수면 탐지·두 날짜 변화 탐지를 미래 홍수/강수 예측이라고 부르지 마.
- 검증되지 않은 결과는 experimental로 표시하고 실제 데이터나 성능을 꾸미지 마.

[지금 할 일]
1. AGENTS.md 및 소스·현재 Git 변경사항을 확인해.
2. 환경변수는 값 노출 없이 존재 여부만 확인해.
3. 로컬 실행, 테스트, Storage 상태와 결과 목록 API를 확인해.
4. 정상이면 현재 준비 상태와 실제 PNG 연결에 필요한 다음 작업을 알려줘.
5. 장애가 있으면 기존 데이터·작업을 보존하면서 원인을 해결해.
6. 기존 프로젝트를 무단으로 새로 만들거나, 필요 없는 DB/프레임워크를 추가하지 마.
사용자에게 필요한 작업은 한 단계씩 한국어로 안내해줘.
```

## 2. 처음부터 재구축해야 할 때의 추가 프롬프트

**1번 프롬프트 뒤에 이어서** 아래를 입력한다. 기존 운영 자원을 쓸 수 있는지는 먼저 구분한다.

```text
이번 환경에서는 사이트 코드를 처음부터 재구축해야 해.
위 인수인계의 기능과 실제 저장소 소스를 참고해 buildless HTML/CSS/JS와
Vercel Node API 함수 구조로 구현해줘. 재사용 범위는 행사 규정을 따라.

우선순위:
1. Vercel에 배포 가능한 웹사이트와 로컬 Node 서버.
2. MapLibre 지구본/지도, 위치 선택, Before/After 기본 화면.
3. Supabase PRIVATE Storage의 results/manifest.json을 읽는 모델 결과 API.
4. published:true PNG만 10분 signed URL로 제공하고 화면에 표시.
5. 빈 목록·미설정 환경변수·잘못된 manifest·실패한 이미지 처리를 구현.
6. 비밀 키를 서버에만 보관하고 .env 파일과 서버 소스의 정적 노출을 차단.
7. 공식 Supabase SDK는 확인한 호환 버전을 고정하고 lockfile을 생성.
8. 모델 실행은 별도 Python 환경에 두고, 임의의 예측 결과를 생성하지 마.

기존 Supabase 프로젝트를 사용할 수 있으면 그대로 연결해.
새 프로젝트가 정말 필요한 경우에만 새 ID·URL을 설정하고 PRIVATE
sarscope-data 버킷과 빈 results/manifest.json을 만들어.
새 GitHub/Vercel 프로젝트가 필요하면 새 저장소명과 실제 배포 주소를 사용하고,
기존 nasasar.vercel.app이 새 프로젝트 주소라고 가정하지 마.
코드 구현·검증을 먼저 하고, 배포가 가능한 상태로 정리해줘.
```

## 3. 현장에서 입력할 실행 명령어

아래 명령은 **Windows 명령 프롬프트(cmd)** 기준이다.
VS Code 터미널의 ▼ → Command Prompt를 선택한다.
PowerShell이라면 npm 대신 npm.cmd를 사용하고, cd /d는 사용하지 않는다.

### A. 같은 PC, 기존 폴더 사용

```cmd
cd /d D:\Nasa_hackerton\SARSCOPE_NISAR_Compare_Vercel
node -v
npm -v
git status
```

Node가 22.16 미만이면 공식 Node.js Windows LTS 설치 파일로 업데이트하고
VS Code와 터미널을 다시 연다. https://nodejs.org/en/download

작업 중인 수정이 없다면 원격의 최신 코드를 가져온다.
변경사항이 있으면 먼저 GPT에게 보존 방법을 확인하고, 강제 초기화하지 않는다.

```cmd
git pull --ff-only origin main
npm ci
npm test
```

환경변수를 **4번**처럼 준비한 다음 실행한다.

```cmd
npm run dev
```

터미널을 열어 둔 채 http://localhost:3000 에 접속한다.
서버 종료는 Ctrl+C. 환경변수를 수정했다면 서버를 재시작한다.

### B. 다른 PC, 저장소 내려받기

원하는 상위 폴더를 탐색기에서 열고 그 위치에서 cmd를 연 뒤:

```cmd
git clone https://github.com/Minjae079/Nasa_SAR.git
cd Nasa_SAR
node -v
npm -v
npm ci
npm test
```

이미 Nasa_SAR 폴더가 있으면 덮어쓰지 말고 그 폴더 상태를 먼저 확인한다.
비공개 저장소라면 본인 GitHub 계정으로 인증한다.
이후 **4번**의 환경변수를 설정하고 npm run dev를 실행한다.

## 4. 로컬 Supabase 환경변수

`.env.local`이 이미 있으면 복사로 덮어쓰지 않는다.
없을 때만 cmd에서 실행:

```cmd
copy .env.example .env.local
```

VS Code에서 .env.local을 열고 다음 값으로 설정한다.

```dotenv
SUPABASE_URL=https://jywbvxyyumznolgultci.supabase.co
SUPABASE_SECRET_KEY=여기에_본인의_sb_secret_전체값
SARSCOPE_PUBLIC_ANALYSES=true
```

위 비밀 키 자리는 실제 키로 바꾼다. DB 비밀번호나 publishable key가 아니다.
본인 Supabase 프로젝트의 Settings → API Keys에서 확인한다.
키를 MD 파일·GitHub·채팅·프론트 JS에 넣지 않는다.

실행 후 확인할 주소:

- http://localhost:3000/api/database-status
- http://localhost:3000/api/model-results

기대하는 Storage 응답:

```json
{"connected":true,"storage":"ready","mode":"files-only"}
```

결과가 아직 없을 때의 정상 응답:

```json
{"results":[],"state":"empty","urls_expire_at":"실행 시점에 생성되는 시각"}
```

`empty`는 정상이고, `awaiting_upload`는 manifest가 없다는 뜻이다.
`disabled`라면 SARSCOPE_PUBLIC_ANALYSES=true 설정 및 서버 재시작을 확인한다.

## 5. Vercel 배포·환경변수

기존 사이트: https://nasasar.vercel.app

기존 프로젝트의 Settings → Environment Variables에서 다음을 확인한다.

| Key | Value |
|---|---|
| SUPABASE_URL | https://jywbvxyyumznolgultci.supabase.co |
| SUPABASE_SECRET_KEY | 로컬에 보관한 것과 같은 프로젝트의 서버용 비밀 키 |
| SARSCOPE_PUBLIC_ANALYSES | true |

적용 환경은 Production. Preview에서도 사용하려면 해당 환경도 별도로 선택한다.
Node.js는 프로젝트의 지원 범위인 22.16 이상 LTS를 선택한다.
현재 Vercel 설정은 buildless 프로젝트이며 package.json에 build 스크립트가 없다.
Framework는 Other, Root Directory는 실제 저장소 루트로 유지한다.
커스텀 Build/Output 설정은 함부로 추가하지 말고 기존 성공 설정을 우선 유지한다.

코드 변경 후:

```cmd
git status
git add 파일1 파일2 파일3
git diff --cached --stat
git diff --cached
git commit -m "Describe the actual change"
git push origin main
```

`파일1 파일2 파일3`는 실제 수정 파일명으로 바꿔야 한다.
위 명령을 예시 그대로 실행하지 않는다.
새 파일도 반드시 선택해야 한다. .env.local과 node_modules는 선택하지 않는다.
전체 변경이 모두 의도한 것이면 git add .도 가능하지만 반드시 staged 내용을 확인한다.

환경변수만 바꿨거나 이미 push했다면 Deployments → 최신 배포 → Redeploy.
환경변수 변경은 재배포해야 운영 코드에 반영된다.

배포 완료 확인:

- https://nasasar.vercel.app/api/database-status
- https://nasasar.vercel.app/api/model-results

새 배포 프로젝트를 만들었다면 nasasar.vercel.app 대신 실제 새 주소를 사용한다.
주소에 https://를 두 번 쓰거나 //api처럼 슬래시를 중복하지 않는다.

## 6. 실제 모델 PNG를 받았을 때

### A. AI 담당자에게 받을 것

- 결과 PNG 원본 파일과 결과 의미·범례
- 관측 날짜·시각(UTC), 입력 자료 ID
- 모델 버전 또는 체크포인트 식별자
- 검증 여부와 알려진 한계
- 지도 오버레이가 필요하면 CRS, 해상도, bounds 또는 네 모서리 좌표

수치 분석 결과와 원본은 AI 쪽에서 별도 보관한다.
사이트용 PNG만으로 확률값·면적 등을 임의 계산하지 않는다.

### B. 업로드 순서

1. Supabase → Storage → sarscope-data → results.
2. 예를 들어 실제 실행 ID run-001 폴더 생성.
3. 실제 PNG를 results/run-001/output.png로 업로드.
4. **이미지 업로드가 끝난 뒤** results/manifest.json을 갱신.
5. 업로드할 때 파일명과 대소문자를 정확히 맞춘다.

아래는 형식 예시다. 날짜·모델·설명을 실제 값으로 바꾼 뒤 사용한다.

```json
{
  "version": 1,
  "results": [
    {
      "id": "run-001",
      "published": true,
      "title": "실제 분석 지역과 결과 이름",
      "observed_at": "2026-11-14T00:00:00Z",
      "model_version": "실제 모델 버전",
      "description": "실제 입력과 출력 의미, 알려진 한계를 설명",
      "validation_status": "experimental",
      "image_path": "results/run-001/output.png"
    }
  ]
}
```

- published는 문자열이 아닌 JSON boolean true여야 한다.
- observed_at은 업로드 시간이 아니라 해당 결과의 관측 시각으로 바꾼다.
- id는 영문·숫자·하이픈·밑줄을 사용하고 결과마다 중복되지 않게 한다.
- image_path는 URL이 아닌 버킷 내부 경로다. sarscope-data/를 앞에 붙이지 않는다.
- PNG 경로는 results/로 시작해야 하고, 파일명은 영문·숫자·._-를 사용한다.
- 현재 최대 100개 항목, manifest 최대 256,000바이트를 검증한다.
- validation_status는 검증 전 experimental 유지. 검증한 경우만 validated.
- Before/After/Water/Change가 각각 PNG라면 서로 다른 id로 4개 항목을 등록한다.
- 아직 공개하지 않을 항목은 published:false. 비공개 버킷을 공개로 바꿀 필요 없다.
- Storage 파일과 manifest만 수정하면 코드 재배포는 필요 없다.

### C. 시연 확인

1. /api/model-results 응답이 state:ready인지 확인.
2. 사이트 → How it works → Load / refresh results.
3. 실제 PNG·제목·날짜·모델 버전·검증 상태 확인.
4. 이미지 주소는 10분 유효. 만료되면 같은 버튼으로 갱신.

## 7. 팀원 PNG를 연결할 때 GPT에 입력할 프롬프트

```text
SARSCOPE 프로젝트에 실제 모델 결과를 연결해줘.
HACKATHON_HANDOFF_KO.md와 supabase/CONNECT.md를 먼저 읽어.
PNG 폴더: [실제 폴더 경로를 입력]
관측 날짜/시각: [실제 값]
모델 버전: [실제 값]
결과 의미와 범례: [실제 설명]

파일을 확인하고 results/<run-id>/ 아래 업로드할 구조 및 manifest.json을
준비해줘. 없는 날짜·좌표·모델 성능은 지어내지 말고 필요한 항목만 물어봐.
기존 결과를 보존하고, PNG를 먼저 올린 뒤 manifest를 갱신하도록 해줘.
Storage에 직접 업로드할 수 없다면 업로드할 로컬 파일과 수동 절차를 제공해.
비공개 버킷을 유지하고 서버 비밀 키를 노출하지 마.
실제 PNG가 사이트에서 보이는지 검증하고, 기존 NASA 탐색 기능도 유지해.
이번 단계는 일반 PNG 표시야. 지도 오버레이와 미래 홍수 예측을 구현했다고
주장하지 마.
```

## 8. 기존 Before/After 화면에 모델 PNG를 넣을 때의 추가 프롬프트

```text
현재 모델 결과는 How it works 안의 카드 목록으로 표시돼.
이제 모델 PNG를 기존 Before/After 비교 화면에서도 선택해서 보여주고 싶어.
먼저 현재 UI와 /api/model-results 응답을 확인해.
NASA 원본 미리보기와 모델 결과를 구분해 표시하고 서로 덮어쓰지 마.
Before/After 매칭 규칙은 실제 관측 날짜·모델 버전·동일 지역을 기준으로 해.
입력 자료에 두 관측이 없으면 억지로 비교 쌍을 만들지 마.
기존 초록 마커 고정, 지구/지도 전환, 별자리 배경을 유지해.
서명 URL 만료·이미지 로딩 실패·빈 결과도 처리해.
실제 결과 파일 정보를 기준으로 구현하고 검증해줘.
```

## 9. 오류가 생겼을 때

| 증상 | 먼저 확인할 것 |
|---|---|
| npm.ps1 서명·실행 정책 오류 | cmd로 열거나 npm.cmd 사용. 실행 정책 변경 불필요 |
| npm ci 실패 | Node 버전, package-lock.json 존재, 네트워크. 잠금파일을 임의 삭제하지 않기 |
| EADDRINUSE / 3000 포트 사용 중 | 기존 개발 서버 터미널에서 Ctrl+C 후 재실행 |
| SUPABASE_NOT_CONFIGURED | .env.local의 URL·sb_secret_ 키, 서버 재시작, 운영 환경변수 |
| SUPABASE_UNAVAILABLE | Supabase 프로젝트 상태, 키의 프로젝트 일치, 버킷 존재, 네트워크 |
| STORAGE_MUST_BE_PRIVATE | sarscope-data의 Public bucket OFF |
| state:disabled | SARSCOPE_PUBLIC_ANALYSES=true 및 재시작/재배포 |
| state:awaiting_upload | sarscope-data/results/manifest.json의 정확한 경로 |
| state:empty | 정상. published:true 항목이 없거나 목록이 비어 있음 |
| INVALID_RESULTS_MANIFEST | JSON 문법·필수 필드·경로·중복 ID·용량 확인 |
| RESULT_NOT_FOUND | 요청 id가 실제 published:true 항목인지 확인 |
| 로컬은 성공, 운영은 실패 | Vercel Production 환경변수·최신 배포·Functions 로그 확인 |
| API 404 | 새 API 파일까지 커밋됐는지, 실제 배포 주소가 맞는지 |
| API 성공인데 PNG가 안 보임 | 파일 경로·대소문자·이미지 실제 업로드 여부·URL 만료 확인 |
| SQL relation scenes already exists | PNG 흐름에 SQL 재실행 불필요. 기존 테이블 삭제하지 않기 |

GPT에게 오류를 전달할 때:

```text
HACKATHON_HANDOFF_KO.md 기준으로 사이트를 실행하는 중이야.
실행 환경: [로컬 cmd / Vercel Production]
실행 명령 또는 URL: [기입]
기대 동작: [기입]
실제 오류: [키·토큰을 지운 오류 메시지]
현재 파일과 로그를 확인해 원인을 찾아 수정하고 검증해줘.
기존 서버·버킷·파일을 초기화하지 말고 비밀 키를 출력하지 마.
```

## 10. 현재 검증된 것과 아직 남은 것

### 확인된 것

- 사이트 프론트와 NASA 관측 검색·비교 코드가 존재.
- 지구본/지도, 선택 마커, 별자리 배경 구현.
- PRIVATE Storage 연결과 고정 JSON 목록 조회 코드 구현.
- 로컬과 운영 URL에서 빈 manifest 정상 응답을 사용자와 확인.
- 작성 당시 테스트 15개 통과.

### 현장에서 확인할 것

- 인터넷과 실제 운영 배포 상태.
- 팀원 PNG를 올린 뒤 실제 이미지 렌더링.
- 결과 의미와 날짜·모델 버전의 정확성.
- 필요 시 기존 Before/After UI에 모델 결과를 연결하는 추가 구현.
- 지도 오버레이는 실제 지리 좌표를 받은 뒤 별도 구현.
- Python 모델 코드와 학습 환경은 현재 사이트 저장소에서 검증한 범위가 아님.

## 11. 현장 출발 전 준비물

- 이 MD 파일과 최신 소스가 있는 저장소/로컬 복사본.
- GitHub, Vercel, Supabase 로그인 및 필요한 2단계 인증 수단.
- 비밀 키는 비밀번호 관리자 등 본인만 접근할 수 있는 곳에 별도 보관.
- 실제 시연 PNG·설명·날짜·모델 버전, 가능하면 로컬 백업.
- 사전 구현·데이터·모델 사용 범위를 행사 규정과 맞춰 기록.

## 관련 링크

- GitHub: https://github.com/Minjae079/Nasa_SAR
- 사이트: https://nasasar.vercel.app
- 운영 결과 API: https://nasasar.vercel.app/api/model-results
- Supabase: https://supabase.com/dashboard/project/jywbvxyyumznolgultci
- 현재 연결 안내: [supabase/CONNECT.md](supabase/CONNECT.md)
- 초기 빈 목록: [supabase/results-manifest.json](supabase/results-manifest.json)
