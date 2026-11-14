# DeepFlood 모델 → PNG → React 연결

이 코드는 제공받은 학습 셀의 SmallUNet4 구조를 재사용하는 **추론·내보내기 연결부**다.
학습 데이터·전처리 셀·학습된 체크포인트는 이 저장소에 없다.
임의 가중치로 실제 결과를 만들거나 원격에 예제 예측을 업로드하지 않는다.

## 입력 자료 다운로드 위치

제공 코드의 지역(Grifton/Kinston, Matthew, Florence)과 4개 클래스는
DeepFlood 데이터셋 설명과 일치한다. 코드가 이 데이터셋을 쓴 것으로 추정되지만,
확정하려면 팀원이 작성한 앞선 셀의 경로·manifest를 확인해야 한다.

- 논문: https://www.nature.com/articles/s41597-025-04554-3
- 데이터 DOI: https://doi.org/10.6084/m9.figshare.28328339
- 자료 페이지에서 SENTINEL_1(VV/VH), GEOTIFF MASK(4클래스 레이블)를 확인한다.
- 제공 코드의 학습은 Grifton/Matthew, 검증은 Kinston/Matthew로 지정돼 있다.
  Florence 테스트 자료는 최종 평가 전까지 학습·튜닝에 사용하지 않는다.
- 원본 SAR와 레이블이 있다고 바로 NPZ 입력이 되지는 않는다. 학습과 같은 날짜·밴드
  순서·좌표 정렬·크롭·해상도·정규화·관측 유효 마스크를 적용해야 한다.
- 2채널이라는 이유로 NISAR HH/HV 또는 임의 PNG로 대체하면 안 된다.
  Sentinel-1과 NISAR는 다른 센서이며 모델 전이의 정확성은 별도 검증해야 한다.

현재 NISAR 자료 자체가 필요할 때는 https://search.asf.alaska.edu 에서 NISAR GCOV
제품을 검색하고 Earthdata 로그인 후 과학 데이터 HDF5를 받는다.
공식 안내: https://nisar-docs.asf.alaska.edu/vertex/
하지만 이 모델의 DeepFlood 전처리 입력과 동일한 것으로 취급하지 않는다.

## 가장 빠른 연결: 기존 학습 노트북에서 내보내기

학습 코드의 `def init`는 `def __init__`, `super().init()`는
`super().__init__()`, F1의 `2precisionrecall`은 `2 * precision * recall`인지
원본을 확인한다. 첨부 텍스트 그대로라면 실행되지 않는다.
추론용 deepflood.py에는 올바른 생성자 이름을 적용했다.

학습된 model과 동일하게 준비한 x가 있는 실제 노트북에서:

```python
import sys
sys.path.insert(0, r"D:\Nasa_hackerton\SARSCOPE_NISAR_Compare_Vercel\ml")
from deepflood import predict_scene, export_prediction

# model: 학습 완료 후 최적 가중치를 복원한 실제 모델
# x: 학습과 동일하게 정규화된 (2, H, W) 배열
# valid_mask: 전처리에서 만든 boolean (H, W) 공통 유효 관측 영역
# 이 변수들은 앞선 실제 전처리/학습 셀에서 준비해야 한다.
prediction = predict_scene(model, x, valid_mask, device=device)
output = export_prediction(
    prediction, valid_mask, "ml-output",
    run_id="고유한-영문-run-id로-변경",
    title="실제 지역과 관측 결과 이름",
    observed_at="실제 UTC 관측시각으로 변경",
    model_version="실제 체크포인트 버전",
    description="입력 센서·채널과 분류 결과의 의미·한계",
)
print(output)
```

위 코드의 메타데이터는 반드시 실제 값으로 바꿔야 한다.
run_id는 영문/숫자/하이픈/밑줄만 허용하며 관측 시각은 2026-11-13T00:00:00Z
형식이다. valid_mask는 레이블의 부재를 육지로 처리하는 대신 실제 관측 유효성을
나타내야 한다. 정답 레이블은 추론 입력 채널에 넣지 않는다.

출력 폴더에는 prediction.png(RGBA), labels.npy(0..3/255),
manifest.entry.json이 생긴다. 실제 분류 배열에서 PNG 색상을 생성하며
유효하지 않은 픽셀 255는 투명 처리한다. labels.npy는 수치 보관용이며 웹에 올리지 않는다.
이것은 지리 좌표 없는 일반 PNG 표시다. 지도 오버레이용 지리보정은 별도다.

## 체크포인트 파일로 실행

CLI는 PyTorch 2.6 이상과 numpy, Pillow가 필요하다. 기존 노트북 환경을 우선 사용한다.
새 환경이 필요하면 가상환경에서 의존성을 설치하고 버전을 기록한다.
PyTorch의 CPU/CUDA 설치는 https://pytorch.org/get-started/locally/ 를 따른다.

전처리 코드에서 다음 구조의 NPZ를 만든다. 입력은 이미 모델에 맞게 준비돼 있어야 한다.

```python
np.savez_compressed("prepared.npz", x=x.astype(np.float32), valid_mask=valid_mask.astype(bool))
```

프로젝트 루트의 cmd에서(예시 메타데이터는 실제 값으로 변경):

```cmd
python ml/deepflood.py --checkpoint path/to/deepflood_unet4_best.pt --input path/to/prepared.npz --run-id grifton-run-001 --title "Grifton model output" --observed-at "2016-10-12T00:00:00Z" --model-version "deepflood-v1" --description "Replace with actual source and preprocessing details"
```

날짜는 형식 예시일 뿐 실제 관측 시각을 확인해야 한다.
weights_only=True로 state_dict 또는 model_state 키의 가중치를 로드한다.
체크포인트 내 다른 Python 객체 때문에 로드되지 않으면 학습 환경에서
`torch.save(model.state_dict(), "weights.pt")`로 순수 가중치를 내보낸다.
로더가 임의 객체 로딩으로 자동 전환하지는 않는다.

## Supabase 업로드

프로젝트 루트에서 기존 .env.local의 서버용 설정을 사용한다.
우선 실제 출력 폴더를 검사하는 dry run:

```cmd
node tools/publish-model-result.mjs --dir ml-output/grifton-run-001
```

실제 게시할 결과가 맞으면:

```cmd
node tools/publish-model-result.mjs --dir ml-output/grifton-run-001 --publish
```

업로더는 기존 manifest를 보존하고 PNG 업로드 후 목록에 추가한다.
동일 run ID를 덮어쓰지 않는다. manifest 동시 덮어쓰기를 막기 위해 팀에서 한 명이
차례대로 게시한다. 다른 작업자가 동시에 manifest를 수정하면 안 된다.
PNG 업로드 후 manifest 갱신 실패 시 파일이 남을 수 있으므로 재실행 전에 상태를 확인한다.
원격 업로드를 실행해야만 파일이 게시되며 서버 API에는 공개 업로드 기능을 추가하지 않았다.

## 사이트 확인

React 브랜치에서 npm run dev 후 홈의 **View model results** 또는 상단
**Model results**를 클릭한다. 실제 PNG를 선택하고 크게 보며 4클래스 범례를 확인한다.
파일 변경만으로 결과가 갱신되며 새 프론트 기능을 운영/Preview에 반영하려면 코드 재배포가 필요하다.

이 모델은 침수 식생·건조 식생·개방 수면·기타를 분류한다.
이를 미래 강수 예측이나 확정 홍수 경보라고 표현하지 않는다.
실제 데이터와 학습된 가중치가 없으므로 현재 실제 모델 결과 생성은 미완료다.

## 로컬 어댑터 검증

```cmd
python -m unittest discover -s ml -p "test_*.py"
npm test
npm run build
```

Python 테스트의 합성 배열과 고정 logits는 패치 처리·NoData·PNG 저장만 검증한다.
학습 성능, NISAR 전이 성능, 실제 모델 결과를 증명하는 테스트가 아니다.
