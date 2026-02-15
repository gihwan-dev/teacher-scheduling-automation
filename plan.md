# 학교 시간표 관리 시스템 구현 계획 (FSD 기반, Local-First)

## 참조 문서

- `SPEC.md`
- `survey.md`
- `AGENTS.md`

## 기술 스택 확정표

| 항목            | 선택                                                                                 | 선정 이유                                                       | 대안                      | 도입 시점 |
| --------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------- | --------- |
| 프레임워크      | TanStack Start                                                                       | TanStack Router와 결합이 자연스럽고 Local-First CSR 시작에 적합 | Next.js App Router        | Phase 1   |
| 라우팅          | TanStack Router (search + hash)                                                      | 공유 URL 상태와 화면 상태를 타입 안정적으로 관리 가능           | React Router + 수동 파싱  | Phase 1   |
| UI 라이브러리   | shadcn/ui + `shared/ui` 재사용                                                       | AGENTS 공통 UI 우선 원칙 준수, 변형 관리 용이                   | Headless UI + 자체 스타일 | Phase 1   |
| 스타일링        | Tailwind CSS + 시멘틱 토큰(`background`, `foreground`, `primary`, `muted`, `border`) | AGENTS 스타일 규칙 준수, 토큰 중심 확장성 확보                  | CSS Modules               | Phase 1   |
| 상태관리        | Zustand(최소 전역) + 컴포넌트 로컬 상태                                              | Undo/Redo 포인터, 현재 작업 컨텍스트 등 최소 전역만 유지        | TanStack Store            | Phase 1   |
| 데이터 저장소   | IndexedDB(Dexie) + `localStorage`(경량 설정 한정)                                    | 스냅샷/정책/이력 대용량 영속화와 브라우저 호환성 확보           | localStorage 단독         | Phase 1   |
| 폼/검증         | Zod 스키마 기반 입력 검증 + `entities/*/lib` 도메인 검증기                           | 정책 입력(F2)과 공유 URL 복원 시 스키마 검증 통합 가능          | Yup, 수동 런타임 체크     | Phase 2   |
| 테스트          | Vitest + RTL + Browser Mode(E2E 성격 핵심 시나리오)                                  | survey 결정사항과 일치, 검증/상태전이 회귀 방지에 적합          | Playwright 단독           | Phase 1   |
| URL 압축/직렬화 | `lz-string` (`compressToEncodedURIComponent`)                                        | 공유 URL 길이 절감, URL-safe 직렬화                             | pako + base64url          | Phase 1   |

## 아키텍처 개요 (FSD)

### 레이어 역할

- `app`: 부트스트랩, 라우터, 전역 Provider, 에러 경계, 초기 hydrate
- `pages`: 라우트 진입 화면, 위젯 조합
- `widgets`: 시간표 그리드/교체 패널/이력 타임라인/공유 패널 같은 복합 UI
- `features`: 생성, 편집, 잠금, 재계산, 교체 확정, URL 공유, Undo/Redo 같은 사용자 액션 유스케이스
- `entities`: 시간표/정책/검증/이력 등 도메인 모델과 규칙
- `shared`: URL codec, persistence adapter, 공통 UI, 공통 타입/유틸

### 슬라이스 전략

- `school`: 학년/반/요일/교시 구조 모델
- `teacher`: 교사 기본 정보(이름, 담당 과목, 기준 시수, 반별 배정 시수)
- `subject`: 과목 정보(이름, 약칭, 계열)
- `fixed-event`: 고정 수업, 출장/행사 일정
- `timetable`: 셀 모델, 스냅샷, 상태 전이
- `teacher-policy`: 교사 선호/회피/일일 시수 정책
- `constraint-policy`: 학생/교사 연강 및 일일 제한 정책
- `locking`: 잠금 상태
- `replacement`: 교체 후보 탐색/정렬/확정
- `change-history`: 이벤트 로그와 시각화용 상태
- `share-state`: 공유 가능한 URL 상태 계약

### Import 규칙 (허용/금지)

- 허용: `app -> pages/widgets/features/entities/shared`
- 허용: `pages -> widgets/features/entities/shared`
- 허용: `widgets -> features/entities/shared`
- 허용: `features -> entities/shared`
- 허용: `entities -> shared`
- 금지: 하위 레이어에서 상위 레이어 import
- 금지: 동일 레이어 슬라이스 직접 내부 참조(`index.ts` public API 경유)
- 금지: `shared`에서 `entities/features/widgets/pages/app` import

## 요구사항 매핑 표 (SPEC -> 구현)

| 요구사항                 | 대상 레이어                                                                                  | 핵심 유스케이스                                           | 완료 기준                                                      | 테스트 포인트                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| F0 학교 운영 데이터 관리 | `features/manage-school-setup`, `entities/school`, `entities/teacher`, `entities/subject`    | 학교 구조/교사/과목/시수/고정 수업 UI 입력 및 검증·영속화 | 데이터 저장/복원 round-trip, 시수 정합성 검증                  | 시수 합계 unit, 데이터 무결성 integration, 입력 폼 browser test |
| F1 기초 시간표 자동 생성 | `features/generate-timetable`, `entities/timetable`, `entities/constraint-policy`            | 필수 제약 우선 충족 + 선호 점수 기반 배치                 | 필수 제약 위반 0건, 생성 실패 시 원인/완화안 표시              | 제약 위반 0건 검증 unit, 생성 실패 사유 노출 integration        |
| F2 교사 배치 조건 관리   | `features/manage-teacher-policy`, `entities/teacher-policy`                                  | 회피/선호/연강 허용 범위 저장 및 검증                     | 상충 정책 저장 차단, 수정 가이드 제공                          | 정책 스키마 unit, 상충 입력 차단 UI test                        |
| F3 수동 수정 및 잠금     | `features/edit-slot`, `features/toggle-lock`, `entities/locking`                             | 셀 편집/이동, 즉시 충돌 검사, 잠금 반영                   | 충돌 시 거부 사유 노출, 잠금 태그 동기화                       | 셀 수정/잠금 keyboard browser test                              |
| F4 부분 재계산           | `features/recompute-unlocked`, `entities/timetable`                                          | 잠금 유지 + 비잠금 범위 재배치                            | 잠금 셀 불변, 실패 시 최선안/원인 제공                         | 잠금 불변 property test, 실패 메시지 integration                |
| F5 교체 후보 탐색        | `features/find-replacement-candidates`, `entities/replacement`, `entities/constraint-policy` | 후보 필터/정렬/확정                                       | 유효 후보만 노출, 후보 0개 시 완화 시뮬레이션 제공             | 후보 정렬 규칙 unit, 후보 0개 UX integration                    |
| F6 연강/일일 제한 검증   | `features/validate-constraints`, `entities/constraint-policy`                                | 생성/수정/교체 전후 검증                                  | 위반 위치/유형/심각도 표준 출력                                | 위반 리포트 snapshot test                                       |
| F7 변경 이력 시각화      | `features/track-change-history`, `entities/change-history`, `widgets/history-timeline`       | 이벤트 기록과 상태 전이 반영                              | `BASE -> TEMP_MODIFIED -> CONFIRMED_MODIFIED`, `LOCKED` 일관성 | 상태 전이 unit, 타임라인 렌더 browser test                      |
| F8 되돌리기/앞으로 가기  | `features/undo-redo`, `entities/change-history`                                              | 커맨드 스택 기반 복원/재적용                              | 복원 시 검증 재실행 및 UI 동기화                               | undo/redo 연속 동작 integration                                 |
| F9 다중 교체 탐색        | `features/find-multi-replacements`, `entities/replacement`                                   | 복수 슬롯 연계 후보 탐색                                  | 시간 상한 내 상위 후보 제시                                    | 탐색 시간 상한 benchmark test                                   |
| 공유 URL 조회            | `features/share-by-url`, `features/load-from-url`, `entities/share-state`                    | 상태 직렬화/압축/복원                                     | 다른 기기에서도 동일 시간표 조회 가능                          | URL round-trip unit, 링크 공유 integration                      |

## 라우팅/상태/데이터 계약

### 라우트 목록

| Path           | 페이지 목적                                                    |
| -------------- | -------------------------------------------------------------- |
| `/`            | 최근 작업 복원/초기 진입                                       |
| `/setup`       | 학교 운영 데이터 관리 — 학교 구조/교사/과목/시수/고정 수업(F0) |
| `/generate`    | 기초 시간표 생성(F1)                                           |
| `/edit`        | 수동 편집/잠금/부분 재계산(F3/F4/F6)                           |
| `/replacement` | 교체 후보 탐색/확정(F5/F9)                                     |
| `/policy`      | 교사/제약 정책 관리(F2/F6)                                     |
| `/history`     | 변경 이력 조회/확정(F7/F8)                                     |
| `/share`       | 공유 링크 생성/복제                                            |

### URL(search/hash) 스키마

- Search 파라미터
- `view`: `grade | class | teacher`
- `grade`: `1 | 2 | 3`
- `class`: 반 번호
- `teacher`: 교사 식별자
- `week`: 주차 기준 키(월요일 00:00 기준)
- `panel`: `violations | candidates | history`
- Hash(payload, lz-string 압축 대상)
- `v`: 스키마 버전
- `grid`: 시간표 배치 데이터
- `locks`: 잠금 셀 집합
- `policy`: 교사/제약 정책 스냅샷
- `meta`: 생성 시드, 생성 시각

### 전역 상태/로컬 상태 경계

- 전역(Zustand)
- 현재 스냅샷 포인터, Undo/Redo 스택 포인터, 작업 컨텍스트
- 로컬(컴포넌트)
- 셀 편집 모드, 패널 열림 상태, 드래그 선택 상태
- URL 제외 상태
- 임시 UI 플래그, 마우스 오버 상태, 토스트 표시 상태

### 저장소 전략

- IndexedDB: 스냅샷, 정책, 변경 이력, Undo/Redo 백업
- localStorage: 테마, 최근 선택 필터, 키보드 사용자 설정
- URL: 공유에 필요한 최소 상태(`grid`, `locks`, `policy`, `meta`)만 포함

## 핵심 UI 구현 전략

### 구현 방식

- 외부 대형 그리드 라이브러리 대신 `widgets/timetable-grid` 커스텀 구현을 사용한다.
- 기본 입력/버튼/다이얼로그는 `shared/ui` 컴포넌트를 조합한다.
- 반복되는 스타일 값은 토큰으로 승격하고 컴포넌트에 raw 값 하드코딩을 금지한다.

### 셀 상태 모델

- 기본 상태: `BASE`, `TEMP_MODIFIED`, `CONFIRMED_MODIFIED`, `LOCKED`
- 파생 상태: `VIOLATION`(검증 결과 오버레이), `CANDIDATE`(교체 후보 프리뷰)
- 상태 표현 규칙: 색상 + 아이콘 + 텍스트 배지를 동시에 제공한다.

### 키보드 조작 계약

- `Arrow`: 셀 이동
- `Enter`: 편집 시작/확정
- `Esc`: 편집 취소
- `Space`: 셀 선택 토글
- `Ctrl/Cmd+L`: 잠금 토글
- `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`: Undo/Redo

### 성능 전략

- 첫 단계는 메모이제이션 + 선택적 렌더링으로 대응한다.
- 표시 셀이 1200개를 넘으면 가상화(`@tanstack/react-virtual`)를 활성화한다.
- 교체 후보 계산(F5/F9)은 Web Worker로 비동기 처리해 메인 스레드 블로킹을 방지한다.

### 접근성 기준

- 그리드는 `role="grid"`, 행/열 헤더는 `rowheader`/`columnheader`를 적용한다.
- 셀의 ARIA 라벨에 학년/반/요일/교시/교사/과목/잠금 여부를 포함한다.
- 색상만으로 상태를 전달하지 않고 아이콘/텍스트를 항상 병행한다.

## 디렉토리 구조 + 파일 책임

```text
src/
  app/
    providers/store-provider.tsx
    router/index.tsx
    bootstrap/hydrate.ts
  pages/
    setup/index.tsx
    generate/index.tsx
    edit/index.tsx
    replacement/index.tsx
    policy/index.tsx
    history/index.tsx
  widgets/
    timetable-grid/ui/timetable-grid.tsx
    candidate-list/ui/candidate-list.tsx
    history-timeline/ui/history-timeline.tsx
    share-link-panel/ui/share-link-panel.tsx
  features/
    manage-school-setup/model/usecase.ts
    generate-timetable/model/usecase.ts
    edit-slot/model/usecase.ts
    recompute-unlocked/model/usecase.ts
    find-replacement-candidates/model/usecase.ts
    undo-redo/model/usecase.ts
    share-by-url/model/usecase.ts
    load-from-url/model/usecase.ts
  entities/
    school/model/types.ts
    school/lib/validator.ts
    teacher/model/types.ts
    subject/model/types.ts
    fixed-event/model/types.ts
    timetable/model/types.ts
    timetable/lib/transition.ts
    constraint-policy/lib/validator.ts
    teacher-policy/lib/policy-schema.ts
    replacement/lib/ranker.ts
    change-history/lib/event-log.ts
    share-state/lib/share-schema.ts
  shared/
    ui/
    url/codec.ts
    persistence/indexeddb/repository.ts
    persistence/local-storage/settings.ts
```

- `shared/ui`는 페이지/피처에서 재사용 가능한 기본 UI만 제공한다.
- 페이지/피처에서 동일 패턴 UI가 반복되면 `shared/ui`로 승격한다.
- 각 슬라이스는 `index.ts`를 public API로 사용한다.

## 단계별 구현 로드맵

| Phase               | 우선순위 | 작업                                                                                                                                             | 산출물                                                                                                          | 완료 기준(DoD)                                                                                                 |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Phase 1 기반 구축   | Must     | TanStack Start 초기화, FSD 구조, Router/Store Provider, URL codec, Dexie 스키마, 토큰/공통 UI 베이스, **학교 운영 데이터 관리(F0) UI 및 저장소** | 실행 가능한 앱 셸, 기본 라우트, 저장소 어댑터, 토큰 정의 문서, **`/setup` 화면에서 데이터 입력·저장·복원 동작** | `pnpm lint`, `pnpm typecheck` 통과 + URL round-trip unit test 통과 + **데이터 저장/복원 round-trip test 통과** |
| Phase 2 핵심 기능   | Must     | F1/F2/F3/F4/F5/F6 + 공유 URL 구현                                                                                                                | 생성/편집/재계산/교체/공유 기능 동작, 정책 관리 화면                                                            | 핵심 시나리오 integration 통과, 필수 제약 위반 0건 검증 테스트 통과                                            |
| Phase 3 운영 안정화 | Should   | F7/F8 구현, 이력 타임라인/확정 플로우                                                                                                            | 이력 시각화, Undo/Redo                                                                                          | 상태 전이 테스트 통과, Browser keyboard 시나리오 통과                                                          |
| Phase 4 고급 탐색   | Could    | F9 다중 교체 탐색, 탐색 시간 상한/휴리스틱 튜닝                                                                                                  | 다중 교체 후보 화면 및 랭킹 결과                                                                                | 지정 데이터셋에서 시간 상한(예: 2초) 내 상위 후보 반환                                                         |

## 테스트/품질 게이트

### 테스트 범위

- 단위(Unit)
- 제약 검증기, 후보 정렬기, 상태 전이, URL codec, 정책 스키마, **시수 정합성 검증기**
- 통합(Integration)
- **데이터 입력 -> 저장 -> 복원** -> 생성 -> 수정 -> 잠금 -> 부분 재계산 -> 교체 확정 -> URL 공유 복원
- 브라우저(Browser)
- 키보드 편집, 접근성 라벨, 이력 타임라인 상호작용

### 품질 게이트

- 정적 검사: ESLint, TypeScript
- 아키텍처 검사: FSD import 규칙 위반 검사
- 회귀 검사: `BASE/TEMP_MODIFIED/CONFIRMED_MODIFIED/LOCKED` 상태 전이 스냅샷 테스트
- CI 실패 기준: 핵심 Must 시나리오 중 1개라도 실패 시 머지 차단

## 리스크 및 대응

| 리스크                    | 감지 방법                                              | 대응 전략                                                                                   |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| URL 길이 초과로 공유 실패 | 링크 생성 시 길이 임계치(브라우저 호환 기준) 자동 검사 | 공유 대상 필드 최소화 + 압축 재시도 + 초과 시 링크 생성 차단 및 축약 안내(이력/뷰옵션 제외) |
| 링크 변조/손상            | URL 복원 시 `v` 스키마/필수 키/Zod 검증 실패 로그      | 복원 중단 후 오류 안내, 최근 로컬 정상 스냅샷 제안                                          |
| IndexedDB 데이터 손상     | 앱 시작 시 스냅샷 무결성 검사 실패 카운트              | 마지막 정상 스냅샷 롤백 + JSON 내보내기/가져오기 복구 경로 제공                             |
| 잠금 과다로 재계산 실패   | 재계산 실패 시 제약 충돌 리포트에 잠금 원인 비율 표시  | 최소 해제 필요 셀 추천 기능 제공                                                            |
| F9 탐색 비용 급증         | 후보 탐색 실행 시간/중단율 메트릭 수집                 | 시간 상한 + 빔서치 + 조기 중단 정책 적용                                                    |

## 오픈 이슈

- URL 길이 임계치(브라우저별)를 QA 단계에서 확정해 링크 생성 정책의 수치를 고정해야 한다.
