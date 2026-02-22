# 학사일정 강연동 시간표 운영 시스템 PRD

> 작성일: 2026-02-22
> 상태: Draft
> 운영 모델: Local-First 단일 운영자
> 기반 문서: `/Users/choegihwan/Documents/Projects/scheduling-automation/SPEC.md`, `/Users/choegihwan/Documents/Projects/scheduling-automation/milestone.md`
> 문서 성격: 기획 요약형(PRD), 구현 세부(DB/알고리즘)는 후속 상세 설계 문서로 분리

---

## 1. 목표 및 핵심 철학

### 1.1 제품 목표

본 시스템은 단순 시간표 생성기가 아니라, 학사일정을 상위 하드 제약으로 강하게 결합한 운영 플랫폼을 목표로 한다.

### 1.2 고정 설계 원칙 (핵심 5요소)

1. 학사일정 = 상위 하드 제약
2. 사전 검증(Pre-Validation)
3. 영향 분석(Impact Analysis)
4. 주차 단위 버전 관리
5. 트랜잭션 기반 수정 + 완전 롤백

### 1.3 운영 원칙

- 모든 수정은 검증과 영향 분석을 거치기 전에는 확정되지 않는다.
- 사용자는 주차 단위로 적용 범위를 명시적으로 선택한다.
- 위반은 사전 차단하며, 오류 메시지는 사람이 바로 이해할 수 있어야 한다.

---

## 2. 범위 정의

### 2.1 In Scope (1차 릴리스)

- 학사일정 관리(학기 시작/종료, 공휴일, 휴업일, 시험기간, 학년/전교 행사, 단축수업)
- 학사일정 -> 시간표 자동 제한 규칙 적용(Hard Constraint)
- 시간표 수정 전 사전 검증 엔진(교사/학급/교실/연강/일일시수/학사일정)
- 변경 전 영향 분석 리포트(교사/학급/시수 변화)
- 학사일정 변경 시 시수 부족 예측 및 보강 추천
- 주차 기반 조회/수정/복제/복원 및 버전 로그 연결
- 트랜잭션 기반 수정(임시 상태 -> 검증 -> 영향 분석 -> 승인 Commit / 실패 Rollback)
- 감사 로그 저장 및 특정 버전 복원
- 수정 적용 범위 선택(이번 주만, 다음 주부터 학기말, 특정 주차 범위)

### 2.2 Out of Scope (2차 릴리스)

- 시험 감독 배정 최적화/통계 고도화
- 결강 대강 자동 추천 고도화(과목 가중치, 누적 공정성 최적화)
- 다중 사용자 동시 편집/권한 체계
- 중앙 서버 동기화 및 온라인 협업 기능

---

## 3. 사용자 및 핵심 운영 시나리오

### 3.1 주요 사용자

- 교무 시간표 담당자: 시간표 편성/수정/확정의 실무 책임자
- 관리자(교감/교무기획): 변경 영향 검토 및 승인/감사 책임자

### 3.2 표준 운영 흐름

모든 핵심 시나리오는 동일한 흐름을 따른다.

`사전 검증 -> 영향 분석 -> 승인/롤백`

### 3.3 대표 시나리오

1. 학사일정 변경 반영
- 상황: 학년 행사 기간이 추가됨
- 기대: 대상 학년 시간표 자동 차단, 시수 부족 자동 계산, 보강안 제시

2. 특정 주차 교체 작업
- 상황: 운영상 사유로 주차 범위 교체 필요
- 기대: 적용 범위 선택 후 영향 리포트 제공, 승인 시 확정, 실패 시 전량 롤백

3. 단축수업일 처리
- 상황: 특정 날짜 교시 수 축소
- 기대: 초과 교시 자동 삭제/이동 제안, 충돌 발생 시 사전 차단

---

## 4. 기능 요구사항

| ID | 기능명 | 설명 | 우선순위 |
| --- | --- | --- | --- |
| AC-01 | 학사일정 관리 | 학기/휴일/시험/행사/단축수업 설정 및 수정 | Must |
| AC-02 | 학사일정 하드 제약 적용 | 날짜/대상 단위로 수업 배정 자동 차단 | Must |
| AC-03 | 사전 검증 엔진 | 교사/학급/교실/연강/일일시수/학사일정 위반 실시간 검증 | Must |
| AC-04 | 영향 분석 및 시수 예측 | 교체/이동/학사일정 변경 전후 영향 및 시수 부족 예측 | Must |
| AC-05 | 주차 버전 관리 | 주차별 독립 버전 생성, 조회, 복제, 복원 | Must |
| AC-06 | 범위 적용 교체 플로우 | 이번 주/다음 주부터/범위 지정 적용 및 재검증 | Must |
| AC-07 | 트랜잭션 수정/롤백 | 임시 상태 기반 수정, 승인 Commit, 실패 Rollback | Must |
| AC-08 | 감사 로그/복원 | 변경 주체/전후 내용/충돌 여부/적용 범위 추적 및 복원 | Must |
| AC-09 | 시험 모드 확장 | 시험 시간표/감독 배정/통계 | Should (2차) |
| AC-10 | 대강 추천 확장 | 결강 시 대체 교사 자동 추천 | Should (2차) |

---

## 5. 제약 규칙 카탈로그 (Hard Constraint)

| 규칙 ID | 조건 | 시스템 동작 | 위반 처리 |
| --- | --- | --- | --- |
| HC-01 | 공휴일/휴업일 | 해당 날짜 시간표 비활성화 | 배정 시도 즉시 차단 |
| HC-02 | 학년 행사 | 대상 학년 전체 수업 차단 | 배정 불가 + 시수 부족 계산 |
| HC-03 | 전교 행사 | 전체 학년 수업 차단 | 배정 불가 + 영향 리포트 생성 |
| HC-04 | 시험기간 | 일반 수업 배정 금지 | 배정 차단 + 시험 모드 전환 조건 체크 |
| HC-05 | 단축수업일 | 날짜별 교시 수 재정의 | 초과 교시 삭제/이동 제안 |
| HC-06 | 교사 불가 시간 | 교사 개인 제약 적용 | 교사 배정 즉시 차단 |
| HC-07 | 중복 배정 금지 | 교사/학급/교실 동시간 중복 금지 | 저장 전 차단 |
| HC-08 | 연강/일일 시수 제한 | 정책 기반 상한 적용 | 위반 발생 시 확정 차단 |

오류 메시지 원칙:
- UUID, 내부 키 등 기계 식별자는 사용자 메시지에 노출하지 않는다.
- 사람 중심 정보(교사명/학년반/요일/교시/과목명/원인)를 기본으로 제공한다.

---

## 6. 데이터 및 인터페이스 계약

### 6.1 신규/확장 타입 계약

```ts
interface AcademicCalendarEvent {
  event_id: string
  event_type:
    | 'SEMESTER_START'
    | 'SEMESTER_END'
    | 'HOLIDAY'
    | 'CLOSURE_DAY'
    | 'EXAM_PERIOD'
    | 'GRADE_EVENT'
    | 'SCHOOL_EVENT'
    | 'SHORTENED_DAY'
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  scope_type: 'SCHOOL' | 'GRADE' | 'CLASS'
  scope_value: string | null
  period_override: number | null
}

interface TimetableSnapshot {
  id: string
  schoolConfigId: string
  week_tag: string
  version_no: number
  base_version_id: string | null
  applied_scope: {
    type: 'THIS_WEEK' | 'FROM_NEXT_WEEK' | 'RANGE'
    from_week: string
    to_week: string | null
  }
  cells: Array<TimetableCell>
  score: number
  generationTimeMs: number
  createdAt: string
}

interface ChangeEvent {
  id: string
  snapshotId: string
  weekTag: string
  actionType: string
  actor: string
  before_payload: unknown
  after_payload: unknown
  impact_summary: string | null
  conflict_detected: boolean
  rollback_ref: string | null
  timestamp: number
  isUndone: boolean
}

interface ValidationViolation {
  rule_id: string
  severity: 'error' | 'warning'
  human_message: string
  location: {
    week_tag?: string
    date?: string
    grade?: number
    class_number?: number
    teacher_name?: string
    day?: string
    period?: number
  }
  related_entities: Array<{
    type: 'TEACHER' | 'CLASS' | 'ROOM' | 'CALENDAR_EVENT' | 'LESSON'
    label: string
  }>
}

interface ImpactAnalysisReport {
  id: string
  affected_teachers: Array<{ teacher_name: string; summary: string }>
  affected_classes: Array<{ grade: number; class_number: number; summary: string }>
  hour_delta: Array<{ target: string; delta: number }>
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  alternatives: Array<string>
}

interface ScheduleTransaction {
  draft_id: string
  target_weeks: Array<string>
  validation_result: {
    passed: boolean
    violations: Array<ValidationViolation>
  }
  impact_report_id: string
  status: 'DRAFT' | 'COMMITTED' | 'ROLLED_BACK'
}
```

### 6.2 내부 서비스 인터페이스(로컬 퍼스트)

- `validateScheduleChange(input) -> ValidationViolation[]`
- `analyzeScheduleImpact(input) -> ImpactAnalysisReport`
- `applyScheduleTransaction(input) -> { status, snapshotId | rollbackReason }`
- `restoreScheduleVersion(weekTag, versionNo) -> TimetableSnapshot`

---

## 7. 비기능 요구사항

### 7.1 성능

- 일반 수정 시 사전 검증 결과는 사용자 상호작용을 방해하지 않는 시간 내 반환되어야 한다.
- 주차 범위 적용 시 영향 분석은 승인 여부를 판단할 수 있는 속도로 제공되어야 한다.
- 주차 조회는 현재 주 + 다음 2~3주를 동시에 확인 가능한 응답성을 보장해야 한다.

### 7.2 복구성/안정성

- 트랜잭션 실패 시 원자적으로 롤백되어야 한다.
- 특정 버전 복원 시 복원 전후 차이를 추적 가능해야 한다.

### 7.3 감사 추적성

- 수정자, 시각, 전후 내용, 적용 주차 범위, 충돌 여부를 로그로 저장해야 한다.
- 감사 로그는 버전 복원 기능과 연결되어야 한다.

### 7.4 UX 가독성

- 충돌 메시지는 사람이 이해 가능한 문장으로 출력한다.
- 운영자가 빠르게 판단할 수 있도록 영향 요약(교사/학급/시수)을 우선 노출한다.

---

## 8. 성공 기준 및 인수 기준

### 8.1 핵심 성공 기준

- [ ] 학사일정이 시간표 생성/수정의 상위 하드 제약으로 동작한다.
- [ ] 사전 검증 단계에서 핵심 충돌(교사/학급/교실/연강/학사일정)을 차단한다.
- [ ] 변경 전 영향 분석 리포트가 승인 결정에 충분한 정보를 제공한다.
- [ ] 주차 단위 버전 생성/복제/복원이 안정적으로 동작한다.
- [ ] 트랜잭션 실패 시 완전 롤백이 보장된다.

### 8.2 인수 테스트 시나리오

- [x] 공휴일/휴업일에 수업 배정 시 즉시 차단된다.
- [x] 학년 행사 기간에 대상 학년 전체 배정이 차단되고 시수 부족이 계산된다.
- [x] 시험기간에는 일반 수업 배정이 금지되고 시험 모드 전환 조건이 만족된다.
- [x] 단축수업일에 초과 교시가 자동 삭제 또는 이동 제안으로 처리된다.
- [x] 주차 범위 교체 시 영향 리포트(교사/학급/연강 변화)가 사전 출력된다.
- [x] 충돌 발생 시 UUID 없이 사람이 읽을 수 있는 메시지로 표기된다.
- [x] 트랜잭션 실패 시 전체 롤백되어 이전 스냅샷과 동일 상태가 보장된다.
- [x] 감사 로그로 특정 버전을 복원했을 때 변경 전/후 추적이 가능하다.
- [x] 현재 주 + 다음 2~3주 동시 조회와 과거 주 조회가 모두 가능하다.
- [x] 특정 주차만 수정했을 때 비대상 주차에 회귀 영향이 없어야 한다.

---

## 9. 리스크 및 완화 전략

| 리스크 | 설명 | 완화 전략 |
| --- | --- | --- |
| 범위 과대 | 핵심 5요소와 확장 기능이 섞이면 일정 지연 가능 | 1차/2차 범위를 엄격 분리하고 릴리스 게이트로 통제 |
| 성능 저하 | 주차 범위 재검증/영향 분석 비용 증가 | 증분 검증, 캐시, 비동기 분석 파이프라인 도입 |
| 데이터 마이그레이션 | 스냅샷/로그 스키마 확장 시 호환성 이슈 | 버전드 스키마, 안전 마이그레이션, 복원 테스트 선행 |
| 운영 가시성 부족 | 변경 영향이 불명확하면 승인 지연 | 영향 리포트 표준 템플릿과 위험도 등급 고정 |
| 오류 메시지 난해함 | 내부 식별자 노출 시 운영 혼선 발생 | 사람 중심 메시지 표준 강제 및 QA 체크리스트 적용 |

---

## 부록: 기본 가정

1. 운영 모델은 로컬 퍼스트 단일 운영자 기준이다.
2. `/Users/choegihwan/Documents/Projects/scheduling-automation/milestone.md`는 학사일정 개편 기준 마일스톤으로 통합되었으며, 구현 진행에 맞춰 갱신한다.
3. DB 상세 설계서, 자동 배정 알고리즘 상세, 미래 주차 교체 플로우 다이어그램, 시수 예측 로직 상세는 후속 문서로 분리한다.
4. 1차 릴리스는 핵심 5요소 중심으로 완료한다.
5. 시험 모드/대강 추천은 2차 확장으로 계획한다.
