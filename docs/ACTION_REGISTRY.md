# 새로운 동작 추가하기 — Action Registry

게임에는 기본 동작 **55개**가 등록되어 있습니다. 새 동작을 개발할 때는 **`ActionRegistry.register({...})` 한 번**으로 여러 편집·시연 화면에 연결할 수 있습니다.

## 연결되는 항목

| 동작 정보 | 자동 연결 |
| --- | --- |
| `id`, `label` | 캐릭터 제작기 동작 목록, 블록의 동작 이름, 저장 데이터 검증 |
| `category` | 스킬 블록의 공격 / 이동 / 보호·회복 / 소환·제어 분류 |
| `parameters` | 행동별 편집 가능한 수치·대상·효과 |
| `family`, `visual` | 실전 2D 이펙트와 동작 미리보기 |
| `preview` | 미리보기 재생 길이·포즈·대상 위치 |
| `audio` | 전용 행동의 발동음·명중음 |
| `physics` | 물리 넉백 분류 (투사체는 약하게, 이동은 넉백 없음) |
| `movementOnly`, `offense` | 순수 이동 비피해 보장 및 공격형 스킬 분류 |
| `execute` | 실제 전투 동작을 수행하는 신뢰할 수 있는 JavaScript 함수 |

**중요:** 새 기술의 공격 판정 및 고유 움직임까지 자동 생성하지는 않습니다. `execute` 함수 안에 기존 안전한 전투 API를 이용해 **실제 동작을 구현**해야 합니다. 이 함수는 게임 개발자가 소스 코드에서만 등록할 수 있고, 사용자가 공유하는 JSON에서 JavaScript를 실행하지 않습니다.

## 추가 코드 예시

아래를 `js/features/custom-actions.js` 등에 넣고, `index.html`에서 `action-registry.js` **이후**, `skill-forge.js` **이전**에 불러오세요.

```js
ActionRegistry.register({
  id: 'superpunch',
  label: '강타 펀치',
  category: 'attacks', // attacks / mobility / defense / special
  executor: 'custom',
  parameters: ['target', 'damage', 'radius', 'knockback'],
  family: 'fist', // fist / projectile / wave / movement / time / explosion / cosmos / generic
  visual: { motif: 'punch', color: '#d67b4b' },
  physics: 'strike', // strike / projectile / none / contact
  preview: { duration: 780, pose: 'arm', anchor: 'caster' },
  audio: { cast: 'heavy', impact: 'hit' },
  offense: true,
  execute(caster, action, target, api) {
    if (target && Math.hypot(target.x - caster.x, target.y - caster.y)
        <= action.radius + target.radius) {
      api.hit(caster, target, action); // 기존 피해·무적·이펙트 판정을 재사용
    }
    return true;
  }
});
```

위 코드는 예시입니다. 신규 동작의 밸런스와 공격 판정은 게임 설계에 맞게 추가하세요. 스킬 모션의 기본 효과는 `family` 렌더러가 그립니다. 완전히 고유한 움직임을 원하면 `skill-visuals.js`의 렌더링 로직을 확장하면 됩니다.

## 이동 전용 예시

`category:'mobility'`, `movementOnly:true`, `physics:'none'`으로 등록하면 오래된 저장 JSON에 피해량이 있더라도 정규화 시 피해량·상태이상·넉백이 제거됩니다.

`execute`에서 실제 위치 조정 동작을 구현하세요. 상대를 튕기거나 피해를 주려면 순수 이동이 아니라 **공격 동작을 별도로 연결**해야 합니다.

## 호환성 및 제약

- 기존 55개 동작, 캐릭터 저장 키, 공유 코드, 독립 쿨타임, 다양한 전투 엔진은 그대로 유지됩니다.
- `ActionRegistry.TYPE` 및 `ActionRegistry.ACTION_PARAMETERS`는 **동적으로 갱신**되는 참조이며 새 동작도 자동 반영됩니다.
- 단일 동작마다 등록 ID가 유일해야 합니다. 중복·잘못된 카테고리·무효 파라미터·실행 함수 없는 신규 등록은 거절됩니다.
- 초기 로딩 뒤 `register`를 호출해도 목록과 제작기는 갱신됩니다.
- `physics:'projectile'`은 기존보다 작은 넉백을 사용합니다.
- 미리보기는 안전한 **시각적 시연**이며 실제 피해·게임 진행 데이터에 영향을 주지 않습니다.
