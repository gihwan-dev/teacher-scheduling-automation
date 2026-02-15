# AGENTS.md

이 문서는 이 저장소에서 작업하는 에이전트용 기본 규칙이다.

## 기술 스택 기준

- 프로젝트 기반은 **TanStack Start**를 사용한다.
- 초기 생성은 아래 명령 프리셋을 기준으로 한다.
  `pnpm dlx shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=nova&baseColor=neutral&theme=neutral&iconLibrary=hugeicons&font=geist&menuAccent=subtle&menuColor=default&radius=default&template=start&rtl=false" --template start`
- 스타일링은 **Tailwind CSS**만 사용한다.

## UI 구현 필수 규칙

1. 시멘틱 토큰 우선

- 컴포넌트에 raw 색상/간격 값을 직접 하드코딩하지 않는다.
- 의미 기반 토큰(`background`, `foreground`, `primary`, `muted`, `border` 등)을 사용한다.
- 새 스타일 값이 필요하면 먼저 토큰 레이어에 추가한 뒤 컴포넌트에서 사용한다.

2. 공통 UI 우선

- 공통 패턴은 `shared/ui` 컴포넌트로 구현하고 재사용한다.
- 페이지/피처 레이어에서 중복 마크업을 복사해 만들지 않는다.
- 버튼/입력/셀렉트/다이얼로그/테이블 등 기본 UI는 공통 컴포넌트를 우선 사용한다.

3. Tailwind 작성 원칙

- 유틸리티 클래스로 구현하고, 필요 시 variant 유틸(cva 등)로 상태 조합을 관리한다.
- 임의값(`[]`) 사용은 최소화하며, 반복되는 값은 토큰/공통 클래스에 승격한다.

## 작업 체크리스트

- [ ] 공통 UI로 해결 가능한 작업인지 먼저 검토했는가?
- [ ] 시멘틱 토큰만 사용해 스타일을 표현했는가?
- [ ] 신규 디자인 값은 토큰으로 먼저 정의했는가?
- [ ] Tailwind CSS 이외 스타일링 방식을 도입하지 않았는가?
