# 프로젝트 개발 마일스톤 (학사일정 강연동 개편)

> 기반 문서: `/Users/choegihwan/Documents/Projects/scheduling-automation/PRD-academic-calendar-linked-timetable.md`
> 실행 라벨: `[SEQUENTIAL]`(순차), `[PARALLEL:PG-n]`(같은 그룹끼리 병렬)
> 분해 기준: 컨텍스트 윈도우 친화 단위(한 번의 구현/검증 세션에서 완료 가능한 크기)
> 1차 릴리스 범위: 핵심 5요소(학사일정 하드 제약, 사전 검증, 영향 분석, 주차 버전, 롤백)

## 병렬 실행 그룹 요약

- `PG-1`: 사전 검증 엔진(Phase 2)과 영향 분석/시수 예측(Phase 3) 병렬 진행
- `PG-2`: 주차 버전 관리(Phase 4)와 적용 범위 교체 플로우(Phase 5) 병렬 진행

## Phase 1. [SEQUENTIAL] 도메인 계약 및 상태 모델 고정

- [x] **학사일정/주차 버전/트랜잭션 공통 계약 확정**
  - 목표: 운영 규칙의 기준 모델(`AcademicCalendarEvent`, 확장 `TimetableSnapshot`, `ScheduleTransaction`)을 확정해 이후 기능의 의사결정을 제거한다.
  - 검증: 핵심 타입 계약이 문서화되고 용어 충돌이 제거된다.
  - 검증: 상태 전이(`DRAFT -> COMMITTED/ROLLED_BACK`)와 예외 정책이 명시된다.
  - 검증: 주차 적용 범위 타입(`THIS_WEEK`, `FROM_NEXT_WEEK`, `RANGE`)이 합의된다.

## Phase 2. [PARALLEL:PG-1] 사전 검증 엔진 구축

- [x] **교사/학급/교실/연강/일일시수 검증 규칙 구현**
  - 목표: 편집/교체/생성 요청 전에 운영 핵심 충돌을 즉시 탐지하고 차단한다.
  - 검증: 교사/학급/교실 중복 및 연강/일일시수 위반이 저장 전 차단된다.
  - 검증: 검증 결과가 일관된 `ValidationViolation` 형식으로 반환된다.

- [x] **학사일정 위반 검증 및 메시지 UX 표준화**
  - 목표: 공휴일/행사/시험기간/단축수업 위반을 실시간 검증하고 사람이 이해 가능한 메시지를 제공한다.
  - 검증: 학사일정 위반이 하드 차단으로 동작한다.
  - 검증: 오류 메시지에서 UUID/내부 식별자 노출이 제거된다.

## Phase 3. [PARALLEL:PG-1] 영향 분석 및 시수 예측

- [x] **변경 전 영향 분석 리포트 구현**
  - 목표: 승인 전에 교사/학급/연강/공강 변화 정보를 리포트로 제공한다.
  - 검증: 최소 한 개 이상의 교체 시나리오에서 영향 리포트가 사전 출력된다.
  - 검증: 리포트에 위험도(`LOW/MEDIUM/HIGH`)와 대안 목록이 포함된다.

- [x] **학사일정 변경 기반 시수 부족 예측 및 보강 추천 구현**
  - 목표: 행사/휴업/단축수업 변경 시 부족 시수를 자동 계산하고 보강 후보를 제시한다.
  - 검증: 학년/학급 단위 부족 시수가 자동 계산된다.
  - 검증: 보강 추천 결과가 리포트 형태로 제공된다.

## Phase 4. [PARALLEL:PG-2] 주차 버전 관리 체계 구현

- [x] **주차 조회와 독립 버전 생성 기능 구현**
  - 목표: 현재 주 + 다음 2~3주 동시 조회, 과거 주 조회, 특정 주차 수정이 가능하도록 한다.
  - 검증: 특정 주차를 수정해도 비대상 주차는 변경되지 않는다.
  - 검증: 주차별 버전 번호가 독립적으로 증가한다.

- [x] **주차 복제/복원 및 버전 로그 연결 구현**
  - 목표: 기존 주차를 복제해 새 버전을 만들고, 특정 버전으로 복원 가능하게 한다.
  - 검증: 복제 후 버전 간 추적 링크(`base_version_id`)가 유지된다.
  - 검증: 복원 시 변경 전후 비교 정보가 감사 로그와 연결된다.

## Phase 5. [PARALLEL:PG-2] 적용 범위 교체 플로우 구현

- [ ] **적용 범위 선택형 교체 워크플로우 구현**
  - 목표: 교체 시 `이번 주만`, `다음 주부터 학기말`, `특정 주차 범위` 선택을 지원한다.
  - 검증: 선택한 범위 외 주차는 변경되지 않는다.
  - 검증: 범위별 적용 결과가 UI에서 명확히 구분된다.

- [ ] **범위 적용 후 재검증 및 대안 제시 구현**
  - 목표: 선택 범위 전체 재검증을 수행하고 충돌 발생 시 대안을 제공한다.
  - 검증: 충돌 발생 시 확정 이전 단계에서 차단된다.
  - 검증: 대안 후보가 영향도와 함께 제시된다.

## Phase 6. [SEQUENTIAL] 트랜잭션 커밋/롤백 및 감사 로그 완성

- [ ] **수정 트랜잭션 파이프라인 구현**
  - 목표: 임시 상태 생성 -> 전체 검증 -> 영향 분석 -> 승인 Commit / 실패 Rollback 흐름을 완성한다.
  - 검증: 실패 시 데이터가 원자적으로 롤백된다.
  - 검증: 승인 전에는 본 스냅샷이 변하지 않는다.

- [ ] **감사 로그 기반 복원 흐름 구현**
  - 목표: 수정자/시각/전후 내용/적용 주차/충돌 여부를 기록하고 복원에 사용한다.
  - 검증: 특정 버전 복원 시 감사 로그로 추적 가능한 이력이 유지된다.
  - 검증: 롤백 참조(`rollback_ref`)가 이력에서 확인된다.

## Phase 7. [SEQUENTIAL] 1차 릴리스 품질 게이트

- [ ] **핵심 5요소 E2E 인수 검증 완료**
  - 목표: 학사일정 제약, 사전 검증, 영향 분석, 주차 버전, 롤백의 종단 시나리오를 통과한다.
  - 검증: PRD 인수 시나리오 10개가 모두 통과된다.
  - 검증: 회귀 테스트에서 기존 시간표 핵심 기능 퇴행이 없다.

- [ ] **운영 인수 기준 및 배포 준비 완료**
  - 목표: 운영자 관점 체크리스트와 장애 대응 기준을 고정한다.
  - 검증: 운영 체크리스트가 문서화되고 승인된다.
  - 검증: 릴리스 후보 버전에서 치명 결함이 0건이다.

## Phase 8. [SEQUENTIAL] 2차 확장 (후속 릴리스)

- [ ] **시험 모드 및 감독 배정 확장**
  - 목표: 시험 시간표 별도 관리, 감독 중복 방지, 감독 통계 기능을 추가한다.
  - 검증: 시험기간 일반 수업 차단과 시험 모드 전환이 일관되게 동작한다.
  - 검증: 감독 배정 중복이 차단된다.

- [ ] **대강 자동 추천 고도화**
  - 목표: 결강 입력 시 공강/과목 적합/누적 공정성을 반영한 대강 추천을 제공한다.
  - 검증: 대강 추천 결과가 우선순위와 근거를 함께 제공한다.
  - 검증: 담임 제외 등 운영 옵션이 반영된다.

---

## 운영 노트

- 본 문서는 학사일정 강연동 개편의 기본 실행 마일스톤(`milestone.md`)으로 통합되었다.
- 1차 릴리스 완료 후 2차(시험 모드/대강 추천) 범위를 재평가한다.
- [2026-02-22] Phase 1 세션 요약:
  - 완료: 도메인 계약 및 상태 모델 고정(학사일정/주차 버전/트랜잭션)
  - 확정 계약:
    - `entities/academic-calendar`: `AcademicCalendarEvent` 타입/스키마 추가
    - `entities/schedule-transaction`: `ScheduleTransaction`/`ValidationViolation` 타입, 상태머신(`DRAFT -> COMMITTED|ROLLED_BACK`) 추가
    - `entities/timetable`: `TimetableSnapshot` 확장(`weekTag`, `versionNo`, `baseVersionId`, `appliedScope`) 및 범위 타입 강제
    - `entities/change-history`: 감사 필드(`actor`, `beforePayload`, `afterPayload`, `impactSummary`, `conflictDetected`, `rollbackRef`) required 적용
  - 저장소/마이그레이션:
    - IndexedDB v6 추가 (`academicCalendarEvents`, `scheduleTransactions` 테이블)
    - v5 -> v6 기본값 마이그레이션 정책 코드화 및 테스트 추가
    - repository API 확장(`loadSnapshotsByWeek`, `loadSnapshotVersion`, `loadLatestSnapshotByWeek`, `saveScheduleTransaction`, `updateScheduleTransaction`, `saveAcademicCalendarEvents`, `loadAcademicCalendarEventsByRange`)
  - 문서화: `academic-calendar-contracts.md` 생성(스네이크/카멜 매핑, 상태 전이 규칙, 기본값 정책 포함)
  - 검증 결과:
    - `pnpm run typecheck`: 통과
    - `pnpm run test:unit`: 28 files, 253 tests 통과 (종료 지연 경고는 기존과 동일)
    - `pnpm exec eslint src`: 통과
  - 다음 미완료 Phase: **Phase 2 (사전 검증 엔진 구축)**
- [2026-02-22] Phase 2 세션 요약:
  - 완료: 사전 검증 엔진 구축(교사/학급/연강/일일시수 + 학사일정 하드 제약)
  - 구현 내용:
    - `features/validate-schedule-change` 신규 추가:
      - `validateScheduleChange(input) -> ValidationViolation[]`
      - `buildAcademicCalendarBlockedSlots`(주차+학사일정 기반 차단 슬롯 계산)
    - `shared/lib/week-tag` 확장:
      - weekTag -> 주 시작일/요일별 날짜/주차 범위 유틸 추가
    - Generate/Edit/Replacement/Recompute 전 경로에 공통 pre-validation 연동
    - 검증 결과 타입을 `ValidationViolation` 중심으로 통일하고 UI 메시지를 `humanMessage` 기반으로 표준화
    - 학사일정 스키마 강화:
      - `GRADE` scopeValue 숫자 문자열 검증
      - `CLASS` scopeValue `"{grade}-{classNumber}"` 형식 검증
    - 마일스톤 파일 전환:
      - 기존 `milestone.md` 제거
      - `milestone-academic-calendar-linked-timetable.md`를 `milestone.md`로 통합
      - PRD/운영 노트 문구 정합성 갱신
  - 테스트:
    - `features/validate-schedule-change` 테스트 2파일 신규 추가
    - `shared/lib/week-tag` 테스트 신규 추가
    - 기존 generate/edit/replacement/recompute 테스트 컨텍스트 갱신
  - 검증 결과:
    - `pnpm run typecheck`: 통과
    - `pnpm run lint src`: 통과
    - `pnpm run test:unit`: 31 files, 266 tests 통과 (종료 지연 경고는 기존과 동일)
  - 다음 미완료 Phase: **Phase 3 (영향 분석 및 시수 예측)**
- [2026-02-22] Phase 3 세션 요약:
  - 완료: 영향 분석 및 시수 예측(교체 사전 리포트 + 학사일정 기반 부족 시수/보강 추천)
  - 구현 내용:
    - `entities/impact-analysis` 신규 추가:
      - `ImpactRiskLevel`, `ImpactAnalysisReport`, `HourShortagePredictionReport` 타입/스키마
    - IndexedDB v7 확장:
      - `impactAnalysisReports` 테이블 추가
      - repository API 확장
        - `saveImpactAnalysisReport`
        - `loadImpactAnalysisReport`
        - `loadImpactAnalysisReportsBySnapshot`
        - `loadAcademicCalendarEvents`
    - `features/analyze-schedule-impact` 신규 추가:
      - `analyzeReplacementImpact` / `analyzeMultiReplacementImpact`
      - `predictHourShortageFromCalendarChange`
    - 교체 플로우 반영:
      - 후보 선택 즉시 영향 분석 -> 리포트 저장 -> 상태 반영
      - 리포트 없으면 단일/다중 교체 확정 차단
      - `ImpactAnalysisPanel` 추가 및 확정 다이얼로그에 리스크 요약 노출
    - 설정 플로우 반영:
      - Setup에 `학사일정` 탭 추가(`AcademicCalendarTable`)
      - `academicCalendarEvents`/`baselineAcademicCalendarEvents` 분리 상태 관리
      - `HourShortageReport` 추가(현재 주 기준 부족 시수 증가 및 보강 추천 표시)
  - 테스트:
    - `entities/impact-analysis` 스키마 테스트 신규 추가
    - 영향 분석/시수 예측 엔진 테스트 신규 추가
    - 교체 스토어 영향 리포트 게이트 테스트 신규 추가
    - 시수 예측 재계산(스토어 상태 변경) 테스트 신규 추가
    - repository 영향 리포트/학사일정 전체 조회 테스트 확장
  - 검증 결과:
    - `pnpm run typecheck`: 통과
    - `pnpm run lint src`: 통과
    - `pnpm run test:unit src/features/analyze-schedule-impact/lib/__tests__/analyze-replacement-impact.test.ts src/features/analyze-schedule-impact/lib/__tests__/predict-hour-shortage.test.ts`: 통과
    - `pnpm run test:unit src/features/find-replacement/lib/__tests__/candidate-ranker.test.ts src/features/find-replacement/lib/__tests__/replacement-finder.test.ts src/features/find-replacement/lib/__tests__/multi-replacement-finder.test.ts`: 통과
    - `pnpm run test:unit src/shared/persistence/indexeddb/__tests__/repository.test.ts`: 통과
  - 다음 미완료 Phase: **Phase 4 (주차 버전 관리 체계 구현)**
- [2026-02-22] Phase 4 세션 요약:
  - 완료: 주차 버전 관리 체계 구현(조회/독립 버전/복제/복원/버전 로그 연결)
  - 구현 내용:
    - 주차 유틸 확장:
      - `shiftWeekTag`, `buildForwardWeekWindow` 추가
    - repository API 확장:
      - `loadSnapshotWeeks`, `loadSnapshotBySelection`, `saveNextSnapshotVersion`, `loadChangeEventsByWeek`
    - 라우트 search 계약 추가:
      - `/generate`: `week`
      - `/edit`, `/replacement`, `/history`: `week`, `version`
    - 공통 UI 추가:
      - `components/ui/week-version-selector` (주차/버전 선택 공통 컴포넌트)
    - 생성/편집/교체 플로우를 append-only 버전 저장으로 전환:
      - 저장/확정 시 항상 새 버전 생성(`versionNo` 독립 증가, `baseVersionId` 연결)
      - 선택 주차/버전 로드 지원 및 URL 컨텍스트 동기화
    - 이력 페이지 확장:
      - 주차/버전 선택 기반 타임라인 조회
      - 동일 주차 내 `복제`/`복원` 액션 추가
      - `VERSION_CLONE`, `VERSION_RESTORE` 감사 이벤트 및 요약 payload 기록
  - 테스트:
    - `shared/lib/week-tag` 테스트 확장
    - repository 테스트 확장(주차 목록/선택 조회/다음 버전 저장/주차별 이력 조회)
    - replacement store 영향 테스트 갱신
    - change-history schema 테스트 확장
  - 검증 결과:
    - `pnpm run typecheck`: 통과
    - `pnpm run lint src`: 통과
    - `pnpm run test:unit src/shared/lib/__tests__/week-tag.test.ts src/shared/persistence/indexeddb/__tests__/repository.test.ts`: 통과
    - `pnpm run test:unit src/features/find-replacement/model/__tests__/store-impact.test.ts src/entities/change-history/model/__tests__/schema.test.ts`: 통과
  - 다음 미완료 Phase: **Phase 5 (적용 범위 교체 플로우 구현)**
