# 프로젝트 개발 마일스톤

> 기반 문서: `SPEC.md`, `plan.md`
> 실행 라벨: `[SEQUENTIAL]`(순차), `[PARALLEL:PG-n]`(같은 그룹끼리 병렬)
> 요구사항 범위: `F0~F9` + 공유 URL 조회/복원

## 병렬 실행 그룹 요약
- `PG-1`: 자동 생성(F1)과 교사 정책 관리(F2) 병렬 개발
- `PG-2`: 편집/재계산(F3/F4), 교체 후보(F5), 공유 URL 기능 병렬 개발

## Phase 1. [SEQUENTIAL] 운영 기반 및 공통 규칙 확정 (F0)
- [x] **학교 운영 데이터 입력 UI 및 저장소 완성**
  - 목표: `/setup` 화면에서 학교 구조(학년/반/요일/교시), 교사(이름/담당 과목/기준 시수/반별 배정 시수), 과목, 고정 수업/출장 데이터를 폼/테이블 UI로 입력·수정·삭제·저장할 수 있다.
  - 포함: 시수 합계 정합성 검증, 교사-과목 미배정 경고, 필수 필드 누락 차단.
  - 검증: 샘플 학교 데이터 1세트를 UI로 입력 후 저장하고, 브라우저 재실행 후 동일하게 복원된다.

## Phase 2. [PARALLEL:PG-1] 핵심 기능 개발 - 기초 자동 생성 (F1, F6)
- [x] **기초 시간표 자동 생성 기능 구현**
  - 목표: 필수 제약 100% 충족을 보장하면서 선호 제약 점수 기반으로 배치를 생성한다.
  - 포함: 생성 실패 시 원인 제약 목록과 완화 후보를 제시한다.
  - 검증: 샘플 학교 데이터 기준 필수 제약 위반 0건, 실패 케이스에서 원인 안내 확인.

## Phase 3. [PARALLEL:PG-1] 핵심 기능 개발 - 교사 배치 조건 관리 (F2)
- [x] **교사 선호/회피/연강 조건 관리 기능 구현**
  - 목표: 교사별 조건을 입력·수정·저장하고 상충 조건은 저장 전에 차단한다.
  - 검증: 전체 회피 등 상충 입력 시 저장 실패 및 수정 가이드 노출, 정상 입력은 생성/재계산에 반영된다.

## Phase 4. [PARALLEL:PG-2] 핵심 기능 개발 - 수동 편집/잠금/부분 재계산 (F3, F4, F6)
- [x] **교시 단위 편집과 잠금 기반 재계산 구현**
  - 목표: 셀 편집/이동/잠금 후 비잠금 영역만 재계산한다.
  - 검증: 잠금 셀은 변경되지 않고, 충돌 편집은 즉시 거부되며 사유가 표시된다.

- [x] **키보드 중심 편집 플로우 완성**
  - 목표: 이동/편집/잠금/확정/취소/되돌리기 단축키가 일관되게 동작한다.
  - 검증: 키보드만으로 선택 -> 수정 -> 잠금 -> 재계산 시나리오를 완료할 수 있다.

## Phase 5. [PARALLEL:PG-2] 핵심 기능 개발 - 학기 중 교체 후보 탐색 (F5)
- [ ] **교체 후보 탐색 및 확정 기능 구현**
  - 목표: 교체 대상 셀 선택 시 충돌/연강/일일 제한/고정 조건을 만족하는 후보만 제시한다.
  - 검증: 후보 0건이면 제약 완화 시뮬레이션이 제공되고, 후보 확정 시 시간표가 일관되게 갱신된다.

## Phase 6. [PARALLEL:PG-2] 핵심 기능 개발 - 공유 URL 조회/복원
- [ ] **상태 공유 링크 생성/복원 기능 구현**
  - 목표: 시간표/잠금/정책 핵심 상태를 링크로 공유하고 다른 환경에서 동일 상태를 복원한다.
  - 검증: 링크 round-trip 후 동일 뷰가 재현되고, 손상된 링크는 안전하게 복원 실패 안내를 제공한다.

## Phase 7. [SEQUENTIAL] 화면 통합 및 운영 안정화 (F7, F8)
- [ ] **변경 이력 타임라인 및 상태 시각화 구현**
  - 목표: `BASE -> TEMP_MODIFIED -> CONFIRMED_MODIFIED`와 `LOCKED` 상태를 시간표/교사표/학급표에 일관되게 표시한다.
  - 검증: 동일 이벤트가 모든 뷰에서 동일한 색상/아이콘/텍스트 규칙으로 표시된다.

- [ ] **Undo/Redo와 확정 플로우 통합**
  - 목표: 되돌리기/앞으로 가기 후에도 제약 검증 결과와 이력 상태가 동기화된다.
  - 검증: 연속 Undo/Redo 이후 최종 데이터 상태와 이력 포인터가 일치한다.

## Phase 8. [SEQUENTIAL] 고급 기능 및 릴리스 준비 (F9 + 품질 게이트)
- [ ] **다중 교체 탐색 기능 구현 (F9)**
  - 목표: 복수 슬롯 연계 교체 후보를 제한 시간 내 계산해 상위안을 제시한다.
  - 검증: 기준 데이터셋에서 시간 상한 내 결과 반환, 단일 교체 기능 품질 대비 퇴행이 없다.

- [ ] **릴리스 품질 게이트 통과**
  - 목표: 핵심 시나리오(생성/수정/교체/공유/복원) 테스트와 정적 검사를 모두 통과한다.
  - 검증: `lint`, `typecheck`, 핵심 테스트 성공 및 Must 요구사항(`F1~F6`) 인수 조건 충족 확인.

---

## 참고 노트

**[2026-02-14] 세션 요약**:
- 완료: Phase 1 전체 구현 (엔터티 4종, IndexedDB 영속 저장소, Zustand 스토어, /setup 탭 UI, 교차 검증, 라우트)
- 발견된 이슈: base-ui Select의 `onValueChange`가 `T | null` 시그니처로 null 가드 필요, Vitest 종료 시 Dexie/fake-indexeddb 프로세스 hang (기능 무관)
- 아키텍처 결정: FSD 레이어 구조 (entities → shared/persistence → features → pages → routes), ESLint 규칙에 따라 `Array<T>` 제네릭 형식 사용
- 다음 페이즈 영향: Phase 2(자동 생성)와 Phase 3(교사 정책)은 이번에 정의한 엔터티/스토어를 그대로 활용 가능

**[2026-02-14] Phase 2 세션 요약**:
- 완료: Phase 2 전체 구현 — 기초 시간표 자동 생성 (F1, F6)
- 구현 내용:
  - `entities/timetable`: TimetableCell, TimetableSnapshot, CellStatus 모델 + Zod 스키마 + 테스트
  - `entities/constraint-policy`: ConstraintPolicy, ConstraintViolation 모델 + validator (교사충돌/학생연강/교사연강/일일시수) + 테스트
  - `features/generate-timetable`: Greedy + Backtracking(depth=3) + Hill-climbing 3단계 알고리즘, TimetableGrid(O(1) 인덱스), scorer(4종 가중 점수), failure-analyzer(원인 분류 + 완화 제안)
  - IndexedDB v2 (timetableSnapshots, constraintPolicies 테이블 추가), Zustand store
  - `/generate` 페이지 UI: 설정 요약, 제약 설정 폼, 결과 패널, 학년/반 선택 시간표 그리드
- 테스트: 10 파일 79 테스트 전체 통과, 3학년 5반 규모(15교사) 생성 성공 확인
- 검증: typecheck, lint, test:unit 모두 통과

**[2026-02-14] Phase 3 세션 요약**:
- 완료: Phase 3 전체 구현 — 교사 선호/회피/연강 조건 관리 (F2)
- 구현 내용:
  - `entities/teacher-policy`: TeacherPolicy, AvoidanceSlot, TimePreference 모델 + Zod 스키마 + validator(5가지 검증 규칙) + 테스트 15건
  - `features/manage-teacher-policy`: Zustand 스토어 (토글 회피, 선호 시간대, override 설정, 검증 연동, DB 저장)
  - IndexedDB v3 (teacherPolicies 테이블 추가), repository save/load 함수
  - `/policy` 페이지 UI: 교사 목록 사이드바(정책/오류 Badge) + 회피 그리드(요일×교시 매트릭스) + 선호 시간대 Select + 연강/일일 시수 override Input + 검증 결과 패널
  - 생성 엔진 통합: buildBlockedSlots에 교사 회피 슬롯 추가, isPlacementValid/findCandidateSlots에 per-teacher daily override, scorer에 timePreference 점수(15%) + per-teacher consecutive override, solver 전체 함수에 teacherPolicies 전달
  - 네비게이션: "설정"과 "생성" 사이에 "교사 조건" 링크 추가
- 신규 파일 12개, 수정 파일 7개
- 테스트: 11 파일 94 테스트 전체 통과 (기존 79 + 신규 15)
- 검증: typecheck, lint, test:unit 모두 통과

**[2026-02-14] Phase 4 세션 요약**:
- 완료: Phase 4 전체 구현 — 수동 편집/잠금/부분 재계산 + 키보드 편집 (F3, F4, F6)
- 구현 내용:
  - Layer 1: TimetableCell에 `status` 필드 추가, CellKey/EditAction/EditValidationResult 타입, DB v4 마이그레이션, repository 확장
  - Layer 2: solver에서 `runPlacementPipeline` + `buildAssignmentUnitsFromCells` 추출, generate-timetable index에 Grid/constraint-checker export 추가, edit-validator(isCellEditable/validateCellEdit/validateCellMove), cell-key 유틸(makeCellKey/parseCellKey/buildCellMap)
  - Layer 3: `recompute-timetable` feature — 잠긴/고정 셀 보존 + 미잠금 재배치 partial-solver
  - Layer 4: `edit-timetable-cell` Zustand store — 로드/포커스/선택/편집(CRUD)/잠금/undo·redo/재계산/저장
  - Layer 5: use-grid-keyboard(Arrow/Enter/Esc/Space/Ctrl+L/Ctrl+Z/Delete), EditableTimetableGrid(상태별 시각화), CellEditorInline, EditToolbar, EditValidationPanel, KeyboardShortcutsPanel
  - Layer 6: `/edit` 라우트 + EditPage 조립 + 네비게이션 링크 추가
- 신규 파일 16개, 수정 파일 8개, 테스트 파일 5개(신규 4 + 기존 수정 1)
- 테스트: 14 파일 129 테스트 전체 통과 (기존 99 + 신규 30)
- 검증: typecheck, lint, test:unit 모두 통과
- 핵심 설계 결정: status를 TimetableCell에 직접 추가, isFixed와 LOCKED 독립 개념, Command 패턴 Undo/Redo, 재계산 시 undo 스택 초기화, Roving tabindex 접근성 패턴
