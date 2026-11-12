# 시스템 목록 (Systems Index)

게임의 시스템과 기획 문서, 상태, 의존 관계. 상태: **Approved**(리뷰 통과) · **In Review**(리뷰 지적 수정 후 재검토 대기) ·
**Reverse-doc**(코드에서 역문서화, 리뷰 전) · **Gap**(구현만 있고 문서 없음) · **Planned**(계획만).
갱신: 2026-11-12(구현 리뷰 결정 반영). 구현 기준 리뷰는 `design/reviews/impl-*.md`.

## 핵심 규칙

| 시스템 | 문서 | 상태 | 구현 | 의존 |
|---|---|---|---|---|
| 전투 | `combat.md` | In Review (비율 방어로 변경) | `World.landHit` 외 | 아이템, 몬스터, 상태 효과 |
| 성장과 생존 (레벨, 능력치, 회복, 무게, 사망) | `progression.md` | In Review (무게·사망·치유 변경) | `World.gainXp/revive/updateStatus` | 경험치 표, 아이템 |
| 강화 | `enhancement.md` | In Review (단계 보너스·자동 저장) | `World.enchant` | 전투, 아이템 |
| 상태 효과 | `status-effects.md` | In Review (마나 물약·저장) | `World.applyPoison/applyCast/landHit` | 전투, 스킬 |
| 스킬과 스킬 슬롯 | `skill-slots.md` | Reverse-doc | `World.grantSkill/assignSkillSlot` | 스킬 데이터, 저장 |
| 전직 | `class-change.md` | In Review (수정 완료) | `World.chooseClass` | 스킬 슬롯, 상태 효과, 늪 재료 |
| 장비와 경제 (제작, 상점, 드롭) | `equipment-economy.md` | In Review (신규) | `World.craft/buy/sell`, `recipes.json` | 상점, 드롭, 의뢰 |
| 성향 | `alignment.md` | In Review (신규) | `World.completeQuest` choices, `shops.json` black | 의뢰, 상점, 야영지 |
| 사냥터 야영지 | `camps.md` | In Review (신규) | `addCamp`, `World.safeHere` | 지역 맵, 상점 |
| 의뢰 (체인, 마커, 진행 목록, HUD 목표) | — | Gap | `World` quests, `UI.r_quests`, NPC 마커 | NPC, 몬스터, 아이템 |
| 낮·밤 | — | Gap | `World.updateNight`, `DAY_LENGTH` 1200초 | 조명, 스폰(nightOnly) |
| 환경 (안개·조명·날씨·빙판) | 지역 문서에 분산 | Gap | `map.ambient/weather`, `World.tryStep` | 렌더, 지역 |

## 콘텐츠

| 지역 | 문서 | 상태 | 레벨 |
|---|---|---|---|
| 1막 5지역 (마을·숲·은광·오크 영지·은광 심부) | — | Gap (원본 복원) | 1–16 |
| 2막 안개 늪 | `act2-fog-marsh.md` | In Review (수정 완료) | 14–20 |
| 2막 무너진 감시탑 | `act2-ruined-watchtower.md` | In Review (수정 완료) | 20–24 |
| 2막 얼어붙은 고개 | `act2-frozen-pass.md` | Approved | 24–28 |
| 2막 고대 수로 | `act2-ancient-aqueduct.md` | In Review (신규) | 28–30 |
| 엔드게임 「심연 회랑」 | — | Planned | 30 |

## 표현·플랫폼

| 시스템 | 문서 | 상태 |
|---|---|---|
| HUD·패널·단축 슬롯·미니맵 | — | Gap (UX 리뷰 `impl-ux.md`) |
| 저장·내보내기·저장소 폴백 | `docs/deploy.md`(기술) | Gap |
| 아트 파이프라인 (codeart2d, recolor, pixelfx) | `tools/codeart/README.md`, `docs/agent-kit.md` | Gap (아트 바이블 없음) |
| 오디오 | — | Gap |
| 자동 사냥 봇(`?bot=1`) | — | Gap (개발 도구) |

## 상위 문서

| 문서 | 상태 |
|---|---|
| 게임 컨셉·핵심 원칙 | Gap — 결정은 `docs/analysis.md` 3절 표에 있음 |
| 2막 서사 아크 | Gap |
| 아키텍처 결정 기록(`docs/architecture/`) | Gap |
