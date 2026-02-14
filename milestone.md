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
- [x] **교체 후보 탐색 및 확정 기능 구현**
  - 목표: 교체 대상 셀 선택 시 충돌/연강/일일 제한/고정 조건을 만족하는 후보만 제시한다.
  - 검증: 후보 0건이면 제약 완화 시뮬레이션이 제공되고, 후보 확정 시 시간표가 일관되게 갱신된다.

## Phase 6. [PARALLEL:PG-2] 핵심 기능 개발 - 공유 URL 조회/복원
- [x] **상태 공유 링크 생성/복원 기능 구현**
  - 목표: 시간표/잠금/정책 핵심 상태를 링크로 공유하고 다른 환경에서 동일 상태를 복원한다.
  - 검증: 링크 round-trip 후 동일 뷰가 재현되고, 손상된 링크는 안전하게 복원 실패 안내를 제공한다.

## Phase 7. [SEQUENTIAL] 화면 통합 및 운영 안정화 (F7, F8)
- [x] **변경 이력 타임라인 및 상태 시각화 구현**
  - 목표: `BASE -> TEMP_MODIFIED -> CONFIRMED_MODIFIED`와 `LOCKED` 상태를 시간표/교사표/학급표에 일관되게 표시한다.
  - 검증: 동일 이벤트가 모든 뷰에서 동일한 색상/아이콘/텍스트 규칙으로 표시된다.

- [x] **Undo/Redo와 확정 플로우 통합**
  - 목표: 되돌리기/앞으로 가기 후에도 제약 검증 결과와 이력 상태가 동기화된다.
  - 검증: 연속 Undo/Redo 이후 최종 데이터 상태와 이력 포인터가 일치한다.

## Phase 8. [SEQUENTIAL] 고급 기능 및 릴리스 준비 (F9 + 품질 게이트)
- [x] **다중 교체 탐색 기능 구현 (F9)**
  - 목표: 복수 슬롯 연계 교체 후보를 제한 시간 내 계산해 상위안을 제시한다.
  - 검증: 기준 데이터셋에서 시간 상한 내 결과 반환, 단일 교체 기능 품질 대비 퇴행이 없다.

- [x] **공유 링크 읽기 전용 뷰 개선**
  - 목표: 공유 링크를 열면 시간표 그리드가 읽기 전용으로 바로 표시된다.
  - 검증: ReadOnlyTimetableView 위젯 추출, share-restore-panel에서 컴팩트 정보 바 + 시간표 그리드 표시.

- [x] **릴리스 품질 게이트 통과**
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

**[2026-02-14] Phase 5 세션 요약**:
- 완료: Phase 5 전체 구현 — 교체 후보 탐색 및 확정 (F5)
- 구현 내용:
  - Layer 1: ReplacementCandidate, CandidateRanking, ReplacementSearchConfig 등 타입 정의, generate-timetable에 scorer/failure-analyzer export 추가
  - Layer 2: replacement-finder (SWAP/MOVE 후보 탐색, isPlacementValid 기반 검증, 재귀 방지 완화 시뮬레이션), candidate-ranker (위반 최소 → 유사도 → 점수 변화 → 공강 최소화 가중 랭킹)
  - Layer 3: find-replacement Zustand store (loadSnapshot, selectTargetCell, search, selectCandidate, confirmReplacement)
  - Layer 4: /replacement 페이지 UI — ReplacementGrid(셀 선택/후보 하이라이트), CandidateListPanel(순위/Badge/AlertDialog 확정), ReplacementPreview(before/after 테이블), RelaxationPanel(완화 제안)
  - Layer 5: `/replacement` 라우트 + 네비게이션 "교체" 링크 추가
- 재사용: TimetableGrid, isPlacementValid, buildBlockedSlots, expandGradeBlockedSlots, computeTotalScore, validateTimetable, isCellEditable, makeCellKey, buildCellMap
- 신규 파일 12개, 수정 파일 2개 (generate-timetable/index.ts, __root.tsx)
- 테스트: 16 파일 143 테스트 전체 통과 (기존 129 + 신규 14)
- 검증: typecheck, lint, test:unit 모두 통과
- 핵심 설계 결정: 완화 시뮬레이션 재귀 방지를 위한 _skipRelaxation 플래그, SWAP은 양쪽 배치 검증 후 grid 원복, base-ui AlertDialog에 render prop 패턴 사용

**[2026-02-14] Phase 6 세션 요약**:
- 완료: Phase 6 전체 구현 — 상태 공유 링크 생성/복원 기능
- 구현 내용:
  - Layer 0: lz-string 의존성 설치
  - Layer 1: `shared/lib/url` — constants(enum↔숫자 매핑), types(SharePayload/CompactCell 등), encoder(buildSharePayload, computeFlatIndex), decoder(restoreFromPayload, UUID 재생성), compress(lz-string 래퍼), index(재수출)
  - Layer 2: `entities/share-state` — Zod 스키마 (superRefine으로 인덱스 범위 검증), 타입 재수출
  - Layer 3: `features/share-by-url` — Zustand store(생성/복원 워크플로우), share-builder(DB→payload→압축URL), share-restorer(hash→검증→복원→임포트)
  - Layer 4: `/share` 페이지 UI — SharePage(hash 유무로 생성/복원 모드 자동 전환), ShareGeneratePanel(URL 생성/표시/복사/길이 Badge), ShareRestorePanel(프리뷰+가져오기), 라우트, 네비게이션 "공유" 링크
  - Layer 5: 테스트 5파일 — compress round-trip, encoder(flatIndex/flags), decoder(UUID 매핑/셀 위치), schema(인덱스 범위/버전), round-trip(전체 파이프라인 동치성)
- 핵심 설계 결정: UUID 제거 인덱스 기반 컴팩트 인코딩, flags bitfield(3비트: status<<1|isFixed), URL hash fragment(서버 전송 없음), 복원 시 새 UUID 생성
- 신규 파일 19개, 수정 파일 2개 (package.json, __root.tsx)
- 테스트: 21 파일 188 테스트 전체 통과 (기존 143 + 신규 45)
- 검증: typecheck, lint, test:unit 모두 통과

**[2026-02-14] Phase 7 세션 요약**:
- 완료: Phase 7 전체 구현 — 변경 이력 시각화 + Undo/Redo 확정 플로우 통합 (F7, F8)
- 구현 내용:
  - Layer 1: `entities/change-history` — ChangeEvent/WeekTag/ChangeActionType 모델, Zod 스키마, week-utils(ISO 8601 주차 계산), 테스트 20건
  - Layer 1-B: `entities/timetable/lib/cell-status` — getCellStatusStyle/getCellStatusClasses/getStatusLabel/getStatusIcon 통합 유틸, StatusIndicator/StatusLegend 공유 컴포넌트
  - Layer 2: IndexedDB v5 (changeEvents 테이블 추가), repository에 saveChangeEvent/loadChangeEvents/updateChangeEvent/deleteChangeEventsBySnapshot 추가
  - Layer 3: `features/track-change-history` — Zustand 스토어 (loadEvents/appendEvent/markLastUndone/markLastRedone/appendRecomputeEvent/confirmTempModified)
  - Layer 4: `edit-timetable-cell` 스토어 수정 — confirmEdit가 TEMP_MODIFIED로 설정, confirmChanges() 신규 액션 (TEMP→CONFIRMED 일괄 전환), 모든 편집 액션에 이력 기록, undo/redo 이력 동기화, recompute 이력 기록, loadSnapshot 시 이력 로드
  - Layer 5: 기존 3개 페이지(edit/generate/replacement) 상태 시각화 통일(공유 cell-status 유틸 사용), edit-toolbar에 "확정" 버튼 추가, edit-page에 StatusLegend 추가, /history 페이지 신규 생성 (필터바 + 주차별 그룹핑 타임라인)
  - Layer 6: `/history` 라우트 + 네비게이션 "이력" 링크 추가
- 핵심 설계 결정: confirmEdit()가 TEMP_MODIFIED로 설정 후 별도 confirmChanges()로 CONFIRMED_MODIFIED 전환, ISO 8601 주차 기반 이벤트 그룹핑, ChangeEvent.isUndone soft flag로 감사 추적, cell-status를 CellStatus Record로 타입 안전하게 매핑
- 신규 파일 17개, 수정 파일 10개
- 테스트: 23 파일 208 테스트 전체 통과 (기존 188 + 신규 20)
- 검증: typecheck, lint, test:unit 모두 통과

**[2026-02-14] Phase 8 세션 요약**:
- 완료: Phase 8 전체 구현 — 다중 교체 탐색(F9) + 공유 뷰 개선 + 릴리스 품질 게이트
- 구현 내용:
  - WI-1 공유 뷰 개선: `widgets/readonly-timetable-view` 추출(TimetableView→ReadOnlyTimetableView 위임), share-page 제목/설명 갱신, share-restore-panel을 컴팩트 정보 바 + 읽기 전용 시간표 그리드 레이아웃으로 재구성
  - WI-2 다중 교체(F9): MultiReplacementCandidate/CombinedRanking/MultiReplacementSearchResult 타입, multi-replacement-finder(카테시안 곱 + 슬롯 충돌/교사 충돌 호환성 검증 + 2초 시간 예산), find-replacement 스토어 확장(isMultiMode/multiTargetCellKeys/searchMulti/confirmMultiReplacement), replacement-page 모드 토글, replacement-grid 다중 선택(색상 링 + 번호 뱃지), multi-candidate-list-panel, multi-replacement-preview
  - WI-3 품질 게이트: typecheck 0 에러, lint(src/) 0 신규 에러, 전체 테스트 통과
- 핵심 설계 결정: FSD widgets 레이어로 ReadOnlyTimetableView 추출(pages 간 import 금지 준수), 카테시안 곱 기반 조합 생성 + performance.now() 시간 예산, isCombinationCompatible로 슬롯 중복 + 교사 동시 배치 검증
- 신규 파일 6개, 수정 파일 7개, 테스트 파일 1개(7건)
- 테스트: 24 파일 215 테스트 전체 통과 (기존 208 + 신규 7)
- 검증: typecheck, lint, test:unit 모두 통과
