import { useEffect } from 'react'
import { ReplacementGrid } from './replacement-grid'
import { CandidateListPanel } from './candidate-list-panel'
import { ReplacementPreview } from './replacement-preview'
import { RelaxationPanel } from './relaxation-panel'
import { useReplacementStore } from '@/features/find-replacement'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function ReplacementPage() {
  const {
    snapshot,
    schoolConfig,
    teachers,
    subjects,
    targetCellKey,
    viewGrade,
    viewClassNumber,
    isLoading,
    isSearching,
    loadSnapshot,
    setViewTarget,
    search,
  } = useReplacementStore()

  useEffect(() => {
    loadSnapshot()
  }, [loadSnapshot])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">데이터 불러오는 중...</p>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Card>
          <CardContent className="flex h-32 items-center justify-center">
            <p className="text-muted-foreground">
              먼저 시간표를 생성하세요. 생성 페이지에서 시간표를 생성한 후 저장하면 교체 탐색을 할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!schoolConfig) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Card>
          <CardContent className="flex h-32 items-center justify-center">
            <p className="text-muted-foreground">
              학교 설정 데이터가 없습니다. 설정 페이지에서 먼저 입력해주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const classCount = schoolConfig.classCountByGrade[viewGrade] ?? 0

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">교체 후보 탐색</h1>
        <p className="text-sm text-muted-foreground mt-1">
          교체할 셀을 선택한 후 탐색 버튼을 눌러 안전한 교체 후보를 확인하세요.
        </p>
      </div>

      {/* 컨트롤바 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={String(viewGrade)}
          onValueChange={(val) => setViewTarget(Number(val), 1)}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: schoolConfig.gradeCount }, (_, i) => i + 1).map((g) => (
              <SelectItem key={g} value={String(g)}>
                {g}학년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(viewClassNumber)}
          onValueChange={(val) => setViewTarget(viewGrade, Number(val))}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: classCount }, (_, i) => i + 1).map((c) => (
              <SelectItem key={c} value={String(c)}>
                {c}반
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={search}
          disabled={!targetCellKey || isSearching}
        >
          {isSearching ? '탐색 중...' : '탐색'}
        </Button>
      </div>

      {/* 2컬럼 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <ReplacementGrid
          schoolConfig={schoolConfig}
          teachers={teachers}
          subjects={subjects}
        />
        <CandidateListPanel
          teachers={teachers}
          subjects={subjects}
        />
      </div>

      {/* 미리보기 */}
      <ReplacementPreview teachers={teachers} subjects={subjects} />

      {/* 완화 제안 */}
      <RelaxationPanel />
    </div>
  )
}
