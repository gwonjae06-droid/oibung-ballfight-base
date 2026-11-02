# 오이붕 아레나: 유지보수 가능한 코드 구조 및 변경 규칙

이 문서는 게임의 현행 `main` 구조와 **반드시 유지할 계약**을 정리합니다. 한 번에 전체를 ES Modules로 변환하는 대신 회귀 테스트로 보호하며 단계적으로 분리합니다.

## 실행 진입점
- `index.html`: 브라우저 로비·무료전투·도전의 탑·스튜디오를 포함하는 메인 앱
- `pvp-runtime.html`: 독립 PvP 실행 환경. 메인 페이지와 겹치는 로컬 JS 파일의 `?v=` 태그를 반드시 동일하게 유지
- `js/core/state.js`: 역사적으로 공유하는 전역 게임 상태(캐릭터 정의, `players`, 타이머 등)
- `js/core/engine.js`: 시작/중지·업데이트·피격/종료 흐름. 글로벌 접근자는 기존 호환을 위해 유지
- `js/features/skill-forge.js`: **호환 퍼사드**. 기존 `SkillForge` API를 유지하고 실행 흐름·전투 상태·캐릭터 인스턴스 생성·등록을 연결
- `js/features/skill-forge-profiles.js`: 프로필 입력 검증·정규화 및 랜덤 조합/테마 정의. `SkillForgeProfilesFactory`는 게임 상태와 DOM·저장소에 접근하지 않고 입력을 변환
- `js/features/skill-forge-storage.js`: 저장 키 `oibung-forge-v3`, 기존 JSON 배열 형태를 그대로 유지하며 실패 시 안전하게 빈 배열로 처리
- `js/features/skill-forge-executor.js`: 승인된 시전 동작을 ActionRegistry → AdvancedCombat → ForgeExpansion → AbilityAtlas → 기존 호환 동작으로 실행. `SkillForgeExecutorFactory`에 타격 권한과 적 조회를 주입
- `js/features/skill-forge-world.js`: **시뮬레이션 틱 전용 모듈**. 투사체 이동·실제 충돌·벽 반사·지형 차폐, 장판·낙뢰·회전 소환체 시간 및 접촉 판정을 관리. 타격은 같은 `hit`/`hitGround`를 주입받아 처리
- `js/features/skill-forge-impact.js`: 권위 있는 커스텀 스킬 타격·피해·상태이상·후속 이펙트/콤보 판정. `SkillForgeImpactFactory`가 충돌과 이동 전용 동작 구분을 의존성으로 받음
- `js/features/skill-forge-casting.js`: 코루틴/블록 시전 예약, 큐 실행 순서, 동작 지연과 독립 스킬 충전 타이머. `SkillForgeCastingFactory`가 실행 함수와 이동 동작 세트를 의존성으로 받음
- `js/features/skill-forge-editor.js`: 캐릭터 스킬 편집 화면·저장 캐릭터 목록·변경/삭제·JSON 가져오기/내보내기. 전투 상태는 주입된 접근자를 통해 읽고 써서 한 곳만 보관
- `js/features/arena-balance-formula.js`: **읽기 전용** 스킬 조합 공격력·방어력 예산 계산기. 전투 동작/DOM/저장소 변경 금지
- `js/features/arena-balance.js`: **전투 중 가변 상태**인 보호막·회복 자원 관리자. 계산기 모듈을 가져와 기존 `ArenaBalance` API로 재노출
- `js/features/tower-challenge.js`: 6개 탑과 최종 보스의 진입·진행·캐릭터·임시 보스 연결. 단계적으로 분리 예정
- `js/features/combo-screen-fx.js`: 판정에 개입하지 않는 화면 효과. 콤보 엔진은 인정된 플레이어 강타 이벤트만 전송

## 지금 지켜야 할 로드 순서

```
state.js → (기존 공격/상태이상/스킬 의존 모듈)
                    ↘ arena-balance-formula.js
                       → arena-balance.js → skill-forge.js
  (공통: skill-forge-impact.js + skill-forge-casting.js + skill-forge-world.js + skill-forge-profiles.js + skill-forge-storage.js + skill-forge-executor.js → skill-forge.js)
  (index.html 전용: skill-forge-editor.js → skill-forge.js)
  (pvp-runtime.html: 편집 UI 없이 여섯 의존성 모듈과 skill-forge.js만 로드)
```

두 HTML 진입점에 공통으로 등장하는 스크립트는 **파일 경로 및 쿼리 버전이 같아야 합니다.** `tests/module-boundaries.test.cjs`에서 이를 검사합니다. 추가 의존성이 생기면 그 테스트에 선후 관계를 등록하세요.

## 안정적인 변경 원칙
1. **저장된 캐릭터 구조를 직접 바꾸지 않기.** 변경 시 버전 필드·정규화·이전 저장본 테스트를 먼저 작성하고 단계별 마이그레이션 추가.
2. **순수 계산 모듈은 전역 게임 상태를 수정하지 않기.** 입력 프로필을 변경하거나 `document`, `localStorage`에 접근하는 순간 분리 의미가 사라집니다.
3. **피해·HP·기세·넉백의 판정 함수는 하나만 유지하기.** 다른 곳에서 값을 다시 계산하거나 특별 처리하면 온라인/탑 간 불일치가 생깁니다.
4. **연출은 이벤트를 구독하되 전투 판정에 다시 진입하지 않기.** 가능하면 시뮬레이션 틱을 건드리지 않고 CSS/Canvas 드로잉 레이어 사용.
5. **재사용 모듈의 로딩 순서와 기존 외부 API는 보존.** `ArenaBalance`, `SkillForge`, `ArenaTower`를 참조하는 구버전 코드와 테스트가 계속 작동해야 합니다.
6. **중복 UI 소스 금지.** 상태를 여러 선택 상자·카드·패널에 따로 저장하지 말고 하나의 선택 상태에서 렌더링.
7. **DOM을 반복 생성하지 않기.** 캔버스 갱신·물리 틱에 `innerHTML` 루프를 넣지 말고 생성 후 클래스와 텍스트만 갱신.
8. **성능 예산 확인.** 1×·2×·10×·100× 가속에서 물리·상태 변화가 동일한지 자동 테스트.

## 변경 전/후 검증
- 문법 검사: `find js server -type f \( -name '*.js' -o -name '*.cjs' \) -print0 | xargs -0 -n1 node --check`
- 회귀 테스트: `node --test tests/*.test.cjs`
- 모듈 연결: `node --test tests/module-boundaries.test.cjs`
- 공개 배포: GitHub Actions `Verify battle game`과 Pages 배포 모두 통과 확인
- 실제 브라우저 재확인: PC/모바일에서 기본·커스텀 캐릭터, 탑 1~10층, 고대의 존재 준비화면, 콤보 3/5/8/12/20, PvP 매칭/결과 등을 테스트

## 장기 개선 순서
1. 로드 순서 검사·모듈 계약을 계속 강화 (이번 작업)
2. 공격/방어 예산 계산과 자원 상태 분리 (이번 작업)
3. `SkillForge`의 편집 UI, 시전 큐, 피해·상태 판정, 투사체·장판·회전 소환체 월드 틱, 데이터 정규화, 저장소, 실행 디스패처의 기능 분리 완료. 등록/삭제·인스턴스 생성 및 실제 UI 렌더러는 기존 퍼사드에 남아 있어 추가 분리 시 회귀 테스트가 필요
4. `ArenaTower`의 전투 준비 UI와 진행 상태 머신 분리
5. `engine.js` HUD 출력과 물리 업데이트 구분
6. 전역 `state.js`를 명시적 인자 주입으로 단계적 대체
7. CSS 이름공간화와 Playwright 시각 회귀 테스트

**중요:** 테스트 통과는 미래의 모든 변경을 무조건 보장하지 않습니다. 새 게임 기능마다 작은 회귀 테스트를 같이 추가해야 합니다.

## Forge 구조 개선 실무 규칙 (2026-11-02)
- 시전 큐와 기세 100 스킬 선택은 서로 다릅니다. 기세를 소비할 **수 있는지** 판단하는 부분은 아직 `skill-forge.js`에 있으며, **예약된 동작을 언제 실행할지**는 `skill-forge-casting.js`가 맡습니다.
- 상태이상 피해와 무적 판정은 반드시 `skill-forge-impact.js`의 동일한 `hit` 경로를 사용해야 합니다. 다른 파일에서 임의로 HP를 변경하는 신규 스킬은 추가하지 마세요.
- 두 공통 모듈의 API를 바꾸면 `tests/module-boundaries.test.cjs`, 관련 VM 전투 테스트와 서버 `server/creative-forge.cjs` 로더도 함께 업데이트해야 합니다.
- `pvp-runtime.html`은 제작 UI를 로드하지 않아도 되지만, 타격/시전 큐 파일과 `skill-forge.js`의 버전 및 순서는 메인 앱과 동일해야 합니다.

## Forge 월드 업데이트 분리 규칙
- 동일 틱 순서: `ArenaCharge.tick` → `ForgeExpansion.update` → `tickQueue` → `SkillForgeWorld.tick`. 바꾸면 기세, 캐스팅 딜레이 및 발동 결과에 영향이 생길 수 있습니다.
- `SkillForgeWorldFactory({hit,hitGround,enemies})`로 *기존의 동일한 타격·대상 판정 함수*를 전달해야 합니다. 이 모듈에 새로운 피해량 계산식이나 무적 로직을 중복 구현하지 마세요.
- 샷의 최대 벽 반사 3회, 장판 30프레임 간격, 회전체 28프레임 간격, 최대 투사체 100/장판 32/회전체 3 등의 기존 제한을 유지합니다. 실제 값은 현재 구현과 회귀 테스트를 먼저 확인하세요.
- 독립 VM 테스트, PvE·PvP 엔트리, 서버 AI 검증기의 스크립트 로드 순서를 `skill-forge-world.js` → `skill-forge.js`로 유지하세요.
- `tests/forge-world-runtime.test.cjs` 및 `tests/module-boundaries.test.cjs`가 이 경계를 보호합니다. 스킬 외형은 `skill-forge.js`의 기존 렌더 경로에 남아 있습니다.

## 안정적인 데이터·실행 모듈 계약
- `SkillForgeProfilesFactory`: 저장 캐릭터와 임시 타워 보스의 HP 상한은 다릅니다. 기존 프로필은 자동 스키마 업그레이드하지 않고 정규화만 수행하며 원본을 변경하지 않습니다.
- `SkillForgeStoreFactory`: 저장 키 `oibung-forge-v3`는 변경하지 않습니다. 읽기가 실패하면 빈 목록으로 처리하며 기존 40개 이상 캐릭터도 임의로 잘라내지 않습니다. 저장 방식 변경 시 먼저 마이그레이션 테스트를 만드세요.
- `SkillForgeExecutorFactory`: 스킬 피해는 `SkillForgeImpactFactory.hit`로 위임합니다. 유일한 타깃 셀렉터 및 순수 이동 처리 규칙을 유지합니다. `SkillForgeCastingFactory`에 실행 함수를 주입한 다음부터 예약 큐가 실행됩니다.
- 로드 순서 계약은 `tests/module-boundaries.test.cjs` 및 `tests/forge-facade-modules.test.cjs`에서 확인합니다. 공통 모듈은 `index.html`, `pvp-runtime.html`, `server/creative-forge.cjs`에 동시 반영해야 합니다.
- 이번 단계는 **자동 테스트 및 정적 구조 개선**이며, 모든 브라우저/실시간 PvP·모바일 그래픽이 완벽하게 검증됐다는 의미는 아닙니다.
