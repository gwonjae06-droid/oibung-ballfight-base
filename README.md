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

## 원본에서 그대로 둔 의심 지점

- `drawRoundedRect`의 오른쪽 위 모서리 곡선이 `y + width`를 사용합니다.
- `handleCombat`의 밀치기에서 B의 y속도가 `-=`로 계산됩니다.

동작을 바꾸지 않으려고 고치지 않았습니다.

## 다음 단계 (예정)

`CUSTOM_DEFS`와 `reRollMatch(forcedDef)`는 "얼굴 사진 + 능력 설명으로 내 캐릭터 만들기" 기능을 붙일 자리로 비워 두었습니다.
