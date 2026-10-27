# 오이붕 맞짱뜨기 시뮬레이터 · 분해판 (기본틀)

단일 HTML(`1vs1-multi-item-shop.html`)을 기능별 파일로 나눈 개발용 기본틀입니다. 동작 코드는 원본을 그대로 옮겼고, **사진(base64 이미지)만 제거**했습니다. 사진이 없으면 캐릭터 색 원 + 이름 첫 글자로 표시됩니다.

## 구조

| 경로 | 역할 |
|---|---|
| `index.html` | 화면 뼈대, 스크립트 로드 순서 |
| `css/style.css` | 전체 스타일 |
| `js/core/state.js` | 공용 상태, 등록소(`CHARACTER_DEFS`, `CUSTOM_DEFS`, `BEHAVIORS`), 파티클·플로팅 텍스트 |
| `js/core/engine.js` | 모드 전환, 대진 생성, 프레임 갱신, 충돌, 승패 판정, HUD 갱신 |
| `js/core/render.js` | 캔버스 그리기, 캐릭터 그리기 훅 호출 |
| `js/characters/*.js` | 캐릭터별 정의·능력·접촉 피해·전용 그리기 (배서준, 오슬우, 이권재, 박성원, 최규원) |
| `js/features/economy.js` | 베팅·상점·아이템 |
| `js/photos.js` | 사진 등록 자리 (기본은 비어 있음) |

## 실행

`index.html`을 브라우저로 열면 됩니다. 사진을 쓰고 싶으면 `assets/`에 이미지를 넣고 `js/photos.js`의 안내대로 `loadPhoto(...)`를 호출하세요. `assets/`는 `.gitignore`로 커밋에서 제외됩니다.

## 새 캐릭터 추가 방법

1. `js/characters/<id>.js`에서 `CHARACTER_DEFS.push({... createInstance ...})`로 정의를 등록합니다.
2. 같은 파일에서 `BEHAVIORS.<id> = { order, update(self, target), onContact(self, other), drawBack(p), ... }`를 작성합니다.
3. `index.html`에 스크립트 태그를 추가합니다.

## 전투 물리·배속 안정화

- 충돌한 캐릭터를 분리하고 반발 방향을 대칭으로 계산해 비정상적인 가속을 방지합니다.
- 같은 위치에서의 충돌도 안전하게 처리하며, 과도한 속도는 최대 12px/시뮬레이션 틱으로 제한합니다.
- 1배속은 기본 60Hz, 2배속은 두 배의 시뮬레이션 진행 속도를 사용하고 캔버스는 화면 프레임당 한 번만 그립니다.
- 파티클과 피해 숫자는 일시정지하면 정지하며, 캐릭터별 아이템 이동속도 증가가 지속됩니다.
- 모든 스크립트를 로드해야 합니다. 게임 루프는 마지막 파일인 `js/features/battle-effects.js`에서 한 번만 시작합니다.

## 검증

Node.js 18 이상에서 외부 라이브러리 설치 없이 아래 명령으로 기본 물리 회귀 테스트를 실행할 수 있습니다.

```sh
node --test tests/physics.test.cjs
```

## 추가 기능

`js/main.js`에서 대진 수동 선택, 사진 적용, 키워드 기반 사용자 캐릭터 생성 기능을 제공합니다. `js/features/battle-effects.js`에서 1/2배속과 타격 이펙트·히트스톱·시각 효과 감소 옵션을 제공합니다.
