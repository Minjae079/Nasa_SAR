# 합성 데이터로 로컬 테스트

현재 React 실험 브랜치의 개발 서버에서만 지원한다.
실제 관측, 학습된 모델 결과, 홍수 탐지 성능을 나타내는 자료가 아니다.
Supabase와 운영 결과 목록은 변경하지 않는다.

## 바로 실행

프로젝트 폴더의 cmd에서:

```cmd
python ml/make_demo.py
npm run dev
```

http://127.0.0.1:3000 에서 **Model results → Load synthetic demo**를 클릭한다.
드롭다운에서 다음 세 PNG를 선택할 수 있다.

1. Synthetic input: 인공 2채널 배열의 시각화
2. Synthetic reference: 생성 규칙으로 만든 참조 클래스
3. Synthetic pipeline output: 비학습 테스트용 계산기의 출력 PNG

이미지와 화면에 SYNTHETIC 표시가 있고 날짜는 의미 없는 placeholder다.
실제 결과로 돌아가려면 **Load / refresh results** 버튼을 누른다.

## 생성되는 파일

```text
demo-data/
  prepared.npz           x: float32 (2,256,384), valid_mask: bool (256,384)
  reference_labels.npy   인공 클래스 0..3, 무효 영역 255
  manifest.json          개발 서버 전용 결과 목록
  README.txt             합성 데이터 설명
  demo-<고유 ID>/
    input.png
    reference.png
    prediction.png
    labels.npy
    manifest.entry.json  published:false, synthetic:true
```

생성 도구는 고정 난수 시드로 재현 가능한 인공 배열을 만든다.
그 배열은 실제 VV/VH·HH/HV 단위나 관측값을 모사한 과학 자료가 아니다.
학습된 SmallUNet4 가중치가 없으므로 임의 가중치를 실제 추론으로 사용하지 않는다.
대신 인공 클래스 프로토타입에 가장 가까운 클래스를 고르는 결정적 fixture를
실제 패치 처리·PNG 내보내기 어댑터에 통과시킨다.
이는 배열 형태, 패치 중첩 처리, NoData, PNG 저장, API·화면 표시를 테스트한다.
U-Net 학습 정확도나 NISAR 자료에 대한 성능은 검증하지 않는다.

demo-data는 Git과 production 빌드에서 제외한다.
데모 API는 Vite 개발 서버에만 등록하며 Vercel/production에는 추가하지 않는다.
서버의 실제 manifest 검증과 업로더는 synthetic/is_demo 항목 게시를 거부한다.
원격 Storage에 데모를 올리기 위한 옵션은 제공하지 않는다.

## 의존성과 테스트

기존 Python 환경의 numpy, Pillow, torch를 사용한다. 환경이 다르면
모델 팀의 가상환경을 사용한다. 이 도구 자체는 체크포인트를 로드하지 않는다.

```cmd
python -m unittest discover -s ml -p "test_*.py"
npm test
npm run build
```

이후 실제 입력과 가중치가 생기면 [ml/README_KO.md](ml/README_KO.md)의
실제 추론·게시 절차로 전환한다. 합성 배열을 실제 모델 성능 평가에 사용하지 않는다.
