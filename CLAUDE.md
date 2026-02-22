# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

고등학교 시간표 자동 생성 및 운영 시스템. 제약 충족 기반 자동 생성, 수동 편집/잠금, 부분 재계산, 학기 중 교체 후보 탐색을 지원한다. 데이터는 IndexedDB(Dexie)에 영속화하며 서버 없이 브라우저에서 동작한다.

## 명령어

```bash
pnpm dev          # 개발 서버 (port 3000)
pnpm build        # 프로덕션 빌드
pnpm test         # 전체 테스트 (vitest run)
pnpm test:unit    # 단위 테스트 (= pnpm test)
pnpm test:acceptance # Phase 7 인수 테스트 (ACCEPT-01~10)
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm release:gate # typecheck + lint + acceptance + unit
pnpm check        # prettier --write . && eslint --fix
```

단일 테스트 실행:

```bash
npx vitest run src/entities/school/model/__tests__/schema.test.ts
```

## 기술 스택

- **프레임워크**: TanStack Start (React 19 + Vite + Nitro SSR)
- **라우팅**: TanStack Router (파일 기반, `src/routes/`)
- **상태 관리**: Zustand (feature별 store)
- **영속화**: Dexie (IndexedDB 래퍼) — `src/shared/persistence/indexeddb/`
- **스타일링**: Tailwind CSS v4 + shadcn/ui (base-nova 스타일, hugeicons 아이콘)
- **검증**: Zod v4 (스키마 검증)
- **테스트**: Vitest + jsdom + Testing Library + fake-indexeddb

## 아키텍처 (FSD 기반)

프로젝트는 Feature-Sliced Design 변형 구조를 사용한다.

```
src/
├── shared/          # 공유 유틸, 상수, 영속화 레이어
│   ├── lib/         # constants, id, types
│   └── persistence/ # IndexedDB database & repository
├── entities/        # 도메인 모델 (schema + types + validator)
│   ├── school/          # 학교 설정 (학년/반/요일/교시)
│   ├── subject/         # 과목
│   ├── teacher/         # 교사 (담당과목, 시수, 반별배정)
│   ├── fixed-event/     # 고정수업/출장
│   ├── timetable/       # 시간표 스냅샷
│   ├── constraint-policy/ # 전체 제약 정책
│   └── teacher-policy/  # 교사별 선호/회피/연강 정책
├── features/        # 비즈니스 로직 (store + lib)
│   ├── manage-school-setup/  # 운영 데이터 CRUD + 검증
│   ├── manage-teacher-policy/ # 교사 조건 관리
│   └── generate-timetable/   # 시간표 생성 엔진 (solver, scorer, constraint-checker)
├── pages/           # 페이지 컴포넌트 (라우트 단위 UI 조합)
├── widgets/         # 복합 UI 위젯
├── components/      # shadcn/ui 공통 컴포넌트
│   └── ui/          # button, input, select, table, tabs 등
└── routes/          # TanStack Router 파일 기반 라우트 정의
```

### 핵심 규칙

- **의존 방향**: shared → entities → features → pages/widgets. 역방향 의존 금지.
- **Entity 구조**: 각 entity는 `model/` (schema.ts + types.ts) + `lib/` (validator.ts) + `index.ts` (재수출)
- **Feature 구조**: `model/` (store.ts — Zustand) + `lib/` (비즈니스 로직)
- **테스트 위치**: 각 모듈 내 `__tests__/` 디렉터리 (예: `src/entities/school/model/__tests__/schema.test.ts`)
- **테스트 패턴**: `src/**/__tests__/**/*.test.{ts,tsx}` (vite.config.ts include 패턴)

## UI 규칙 (AGENTS.md)

- **시멘틱 토큰 우선**: raw 색상/간격 값 대신 `background`, `foreground`, `primary`, `muted`, `border` 등 의미 기반 토큰 사용
- **공통 UI 우선**: `src/components/ui/`의 shadcn 컴포넌트 재사용. 중복 마크업 금지.
- **Tailwind 전용**: CSS-in-JS, styled-components 등 다른 스타일링 방식 사용 금지
- **임의값(`[]`) 최소화**: 반복되는 값은 토큰/공통 클래스로 승격

## 영속화 패턴

모든 데이터는 `src/shared/persistence/indexeddb/`를 통해 IndexedDB에 저장된다.

- `database.ts`: Dexie 스키마 정의 (버전 마이그레이션 포함)
- `repository.ts`: CRUD 함수들 (save/load/delete)
- Feature store의 `loadFromDB()` / `saveToDB()`로 영속화 연동

## Path Alias

`@/*` → `./src/*` (tsconfig.json paths + vite-tsconfig-paths)
