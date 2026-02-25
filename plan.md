# 파일 SSOT 기반 Setup Import + Autosave 구현 계획

## 1. 문서 목적
이 문서는 `setup` 중심 워크플로우에서 다음 기능을 구현하기 위한 결정 완료 사양이다.

1. 최종 시간표 `.xlsx` 업로드 반영
2. 교사 시수표 `.xls` 업로드 반영
3. 수동 저장 버튼 제거 및 디바운스 자동 영구 저장

구현자는 본 문서만으로 추가 의사결정 없이 구현 가능해야 한다.

---

## 2. 고정 의사결정
1. 자동 저장 적용 범위는 `setup` 페이지만 대상이다.
2. 최종 시간표 입력 기능은 `setup` 탭 안에 추가한다.
3. 업로드 반영 방식은 기본적으로 `대상 데이터 치환`이다.
4. 교사 시수표 업로드 후 기존 시간표는 `즉시 자동 재생성`한다.
5. 이름 불일치 정책은 `파일 SSOT`로 처리한다.

---

## 3. 현재 기준선
- `setup` 데이터는 IndexedDB에 저장되지만, 현재는 저장 버튼(`saveToDB`) 의존 흐름이다.
- `setup`의 변경 감지는 `isDirty` 기반이며 `useUnsavedWarning`으로 이탈 경고만 제공한다.
- `.xls`/`.xlsx` 업로드 파서 및 Import 탭 UI는 없다.

---

## 4. 구현 범위

### 4.1 Setup 자동 저장
- 저장 버튼 의존을 제거한다.
- `700ms` 디바운스로 IndexedDB 저장을 수행한다.
- `pagehide`, `visibilitychange(hidden)` 이벤트에서 pending 저장을 즉시 flush한다.
- 디바운스 구간 유실 방지를 위해 `localStorage` 키 `setup-draft-v1`에 최신 드래프트를 동기 저장한다.
- 초기 로드 시 IndexedDB 데이터와 로컬 드래프트의 최신 시각을 비교해 더 최신 데이터를 복원한다.
- 저장 상태 UI를 노출한다.
  - `저장 중`
  - `마지막 저장 시각`
  - `저장 오류`
- 이탈 경고 조건은 `isDirty || isAutoSaving`으로 확장한다.

### 4.2 교사 시수표 `.xls` 업로드
- 템플릿 시트명: `교사별시수표`.
- 필수 헤더 검증:
  - `정식과목명`
  - `단축과목명`
  - `교사명`
  - 학년/반 시수 컬럼 + `계`
- 파싱 결과를 `subjects`, `teachers`, `assignments`로 정규화한다.
- 파일 SSOT 규칙으로 교사/배정/기준 시수를 치환 반영한다.
- orphan 정리를 수행한다.
  - `fixedEvents`의 `teacherId`, `subjectId` 참조 무효 항목 제거 또는 정정
  - `teacherPolicies`의 미존재 교사 정책 제거
- 저장 성공 직후 현재 선택 주차에 대해 자동 재생성 파이프라인을 실행한다.
- 자동 재생성 실패 시:
  - 시수표 반영 자체는 유지
  - 실패 원인과 경고를 `importReport`에 기록

### 4.3 최종 시간표 `.xlsx` 업로드
- 템플릿 시트명: `1학기 시간표`.
- 클래스 영역과 교사 영역을 동시에 파싱한다.
- 요일/교시 컬럼 매핑은 템플릿 고정 규칙(월~금 블록)으로 처리한다.
- `schoolConfig`는 파일 구조로 재계산한다.
  - `activeDays`
  - `periodsByDay`
  - `gradeCount`
  - `classCountByGrade`
- 슬롯별 과목/교사 연결은 이름 정규화 기반으로 수행한다.
- 필수 충돌은 `blocking error`로 간주하여 전체 반영 중단한다.
  - 동일 클래스 슬롯 다중 교사 매칭
  - 교사-클래스 매칭 불능
  - 필수 헤더/구조 누락
- 성공 시:
  - setup 데이터 저장
  - 대상 주차 snapshot 새 버전 저장
  - `/edit`에서 즉시 조회 가능 상태 보장

---

## 5. Public API / 인터페이스 변경

### 5.1 `SetupTab`
- `'import'` 추가

### 5.2 `useSetupStore` state
- `isAutoSaving: boolean`
  - 의미: 디바운스 저장 또는 flush 저장이 진행 중인지 여부
  - 기본값: `false`
- `lastAutoSavedAt: string | null`
  - 의미: 마지막 자동 저장 성공 시각(ISO 문자열)
  - 기본값: `null`
- `autoSaveError: string | null`
  - 의미: 가장 최근 자동 저장 실패 메시지
  - 기본값: `null`
- `importReport: ImportReport | null`
  - 의미: 최근 업로드 반영 결과 요약 및 이슈 목록
  - 기본값: `null`
- `targetWeekTagForImport: WeekTag`
  - 의미: import 반영 및 리포트 기록 대상 주차
  - 기본값: 현재 기준 주차(`computeWeekTagFromTimestamp(Date.now())`)

### 5.3 `useSetupStore` actions
- `importTeacherHoursFromFile(file: File): Promise<void>`
  - 성공 시 `importReport.status`는 `SUCCESS` 또는 `PARTIAL_SUCCESS`
  - blocking error 존재 시 반영 중단 + `importReport.status = 'FAILED'`
- `importFinalTimetableFromFile(file: File): Promise<void>`
  - 성공 시 setup + snapshot 반영
  - blocking error 존재 시 전체 반영 중단 + `importReport.status = 'FAILED'`
- `scheduleAutoSave(): void`
  - `700ms` 디바운스 예약만 수행
- `flushAutoSave(reason: 'debounce' | 'pagehide' | 'manual'): Promise<void>`
  - `reason` 계약은 `AutoSaveFlushReason = 'debounce' | 'pagehide' | 'manual'`
  - 성공 시 `lastAutoSavedAt` 갱신 + `autoSaveError` 초기화
  - 실패 시 `autoSaveError` 설정 + `isAutoSaving` 종료 보장(`finally`)

### 5.4 신규 타입
- 타입 선언은 아래 계약을 SSOT로 사용한다.

```ts
import type { DayOfWeek } from '@/shared/lib/types'
import type { WeekTag } from '@/shared/lib/week-tag'

export type ImportSource = 'TEACHER_HOURS_XLS' | 'FINAL_TIMETABLE_XLSX'
export type ImportStatus = 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED'
export type ImportIssueSeverity = 'error' | 'warning'
export type ImportIssueCode =
  | 'SHEET_NOT_FOUND'
  | 'HEADER_MISMATCH'
  | 'INVALID_STRUCTURE'
  | 'INVALID_ROW'
  | 'DUPLICATE_NORMALIZED_NAME'
  | 'MATCH_NOT_FOUND'
  | 'MATCH_CONFLICT'
  | 'UNKNOWN'

export interface ImportIssue {
  code: ImportIssueCode
  severity: ImportIssueSeverity
  blocking: boolean
  message: string
  location?: {
    sheetName?: string
    row?: number
    column?: string
    field?: string
  }
}

export interface ImportReport {
  source: ImportSource
  status: ImportStatus
  targetWeekTag: WeekTag
  createdAt: string
  issues: Array<ImportIssue>
  summary: {
    errorCount: number
    warningCount: number
    blockingCount: number
  }
}

export interface TeacherHoursImportPayload {
  sheetName: '교사별시수표'
  subjects: Array<{ name: string; abbreviation: string }>
  teachers: Array<{ name: string; baseHoursPerWeek: number }>
  assignments: Array<{
    teacherName: string
    subjectName: string
    grade: number
    classNumber: number
    hoursPerWeek: number
  }>
  issues: Array<ImportIssue>
}

export interface FinalTimetableImportPayload {
  sheetName: '1학기 시간표'
  schoolConfig: {
    gradeCount: number
    classCountByGrade: Record<number, number>
    activeDays: Array<DayOfWeek>
    periodsByDay: Partial<Record<DayOfWeek, number>>
  }
  slots: Array<{
    grade: number
    classNumber: number
    day: DayOfWeek
    period: number
    subjectName: string
    teacherName: string
  }>
  issues: Array<ImportIssue>
}

export type AutoSaveFlushReason = 'debounce' | 'pagehide' | 'manual'
```

### 5.5 신규 유틸
- `teacher-hours-xls parser`
- `final-timetable-xlsx parser`
- `name-normalizer`

### 5.6 저장소 계약
- IndexedDB 스키마 마이그레이션은 수행하지 않는다.
- 로컬 임시 저장은 `localStorage: setup-draft-v1` 키를 사용한다.

---

## 6. 파일 SSOT 정규화 규칙
1. 이름 정규화 순서
   - trim
   - 연속 공백 축약
   - 괄호 표기 제거
   - 줄바꿈 첫 줄 우선
2. 동일 정규화 키 중복 시
   - 파일 내 등장 순서 우선
   - 중복 경고를 리포트에 기록
3. 반영 단위
   - 파일별 트랜잭션 단위 반영
   - blocking error 존재 시 전체 롤백
4. 리포트
   - `error`/`warning`를 `importReport`로 사용자에게 제공

---

## 7. 반영 트랜잭션 순서

### 7.1 교사 시수표 업로드
1. 파일 파싱 + 헤더 검증
2. payload 정규화
3. setup 데이터 치환 반영
4. orphan 정리
5. IndexedDB 저장
6. 자동 재생성 실행
7. 결과 리포트 저장

### 7.2 최종 시간표 업로드
1. 파일 파싱 + 구조 검증
2. payload 정규화
3. setup 데이터 치환 반영
4. orphan 정리
5. snapshot append-only 저장
6. 결과 리포트 저장

---

## 8. 테스트 전략

### 8.1 파서 단위 테스트
1. 교사 시수표 정상 파일 파싱 성공
2. 교사 시수표 헤더 불일치 시 blocking error
3. 최종 시간표 정상 파일 파싱 성공
4. 최종 시간표 교사 다중 충돌 시 blocking error

### 8.2 스토어/저장 테스트
1. `setup` 변경 후 700ms 내 자동 저장 수행
2. `pagehide` 시 flush 저장 수행
3. 로컬 드래프트가 DB보다 최신이면 복원
4. 저장 실패 시 `autoSaveError` 설정

### 8.3 통합 시나리오
1. 시수표 업로드 후 setup 반영 + 자동 재생성 + snapshot 생성
2. 재생성 실패 시 setup 반영 유지 + 리포트 표시
3. 최종 시간표 업로드 성공 후 `/edit`에서 즉시 조회 가능
4. 기존 핵심 기능(`/generate`, `/edit`, `/policy`, `/history`) 회귀 없음

---

## 9. 완료 기준 (DoD)
1. `setup` 페이지에서 저장 버튼 없이 데이터 유실 없이 복원된다.
2. 두 엑셀 파일 업로드가 템플릿 기준으로 동작한다.
3. 업로드 실패/부분성공/성공 상태가 리포트로 구분된다.
4. 시수표 업로드 후 자동 재생성 결과가 snapshot 버전으로 남는다.
5. `pnpm run typecheck`, `pnpm run lint src`, 핵심 테스트가 통과한다.

---

## 10. 비목표
1. `/policy`, `/edit`, `/exam`의 자동 저장 확장
2. 신규 IndexedDB 버전 마이그레이션
3. 템플릿 외 임의 포맷 자동 추론 지원
