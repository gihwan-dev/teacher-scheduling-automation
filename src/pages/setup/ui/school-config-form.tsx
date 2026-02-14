import { useCallback, useEffect } from 'react'
import type { SchoolConfig } from '@/entities/school'
import type { DayOfWeek } from '@/shared/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useSetupStore } from '@/features/manage-school-setup'
import { calculateSlotsPerClass, calculateTotalSlots } from '@/entities/school'
import { DAYS_OF_WEEK, DAY_LABELS } from '@/shared/lib/constants'
import { generateId } from '@/shared/lib/id'

function createDefaultSchoolConfig(): SchoolConfig {
  return {
    id: generateId(),
    gradeCount: 3,
    classCountByGrade: { 1: 10, 2: 10, 3: 9 },
    activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    periodsPerDay: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function SchoolConfigForm() {
  const { schoolConfig, setSchoolConfig } = useSetupStore()

  useEffect(() => {
    if (!schoolConfig) {
      setSchoolConfig(createDefaultSchoolConfig())
    }
  }, [schoolConfig, setSchoolConfig])

  const config = schoolConfig ?? createDefaultSchoolConfig()

  const handleGradeCountChange = useCallback(
    (value: number) => {
      const newClassCount = { ...config.classCountByGrade }
      // 학년 수 줄이면 초과 학년 제거
      for (const key of Object.keys(newClassCount)) {
        if (Number(key) > value) delete newClassCount[Number(key)]
      }
      // 학년 수 늘리면 기본값 추가
      for (let g = 1; g <= value; g++) {
        if (!(g in newClassCount)) newClassCount[g] = 1
      }
      setSchoolConfig({ ...config, gradeCount: value, classCountByGrade: newClassCount })
    },
    [config, setSchoolConfig],
  )

  const handleClassCountChange = useCallback(
    (grade: number, count: number) => {
      if (count < 1 || count > 20 || isNaN(count)) return
      setSchoolConfig({
        ...config,
        classCountByGrade: { ...config.classCountByGrade, [grade]: count },
      })
    },
    [config, setSchoolConfig],
  )

  const handleDayToggle = useCallback(
    (day: DayOfWeek) => {
      const days = config.activeDays.includes(day)
        ? config.activeDays.filter((d) => d !== day)
        : [...config.activeDays, day].sort(
            (a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b),
          )
      if (days.length === 0) return
      setSchoolConfig({ ...config, activeDays: days })
    },
    [config, setSchoolConfig],
  )

  const handlePeriodsChange = useCallback(
    (periods: number) => {
      if (periods < 1 || periods > 10 || isNaN(periods)) return
      setSchoolConfig({ ...config, periodsPerDay: periods })
    },
    [config, setSchoolConfig],
  )

  const totalSlots = calculateTotalSlots(config)
  const slotsPerClass = calculateSlotsPerClass(config)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>학교 구조</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 학년 수 */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <Label>학년 수</Label>
            <Select value={config.gradeCount} onValueChange={(val) => val !== null && handleGradeCountChange(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={1}>1학년</SelectItem>
                <SelectItem value={2}>2학년</SelectItem>
                <SelectItem value={3}>3학년</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 학년별 반 수 */}
          {Array.from({ length: config.gradeCount }, (_, i) => i + 1).map((grade) => (
            <div key={grade} className="grid grid-cols-[120px_1fr] items-center gap-4">
              <Label>{grade}학년 반 수</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={config.classCountByGrade[grade] ?? 1}
                onChange={(e) => handleClassCountChange(grade, parseInt(e.target.value, 10))}
                className="w-24"
              />
            </div>
          ))}

          {/* 운영 요일 */}
          <div className="grid grid-cols-[120px_1fr] items-start gap-4">
            <Label className="pt-1">운영 요일</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayToggle(day)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    config.activeDays.includes(day)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>
          </div>

          {/* 교시 수 */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <Label>일일 교시 수</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={config.periodsPerDay}
              onChange={(e) => handlePeriodsChange(parseInt(e.target.value, 10))}
              className="w-24"
            />
          </div>
        </CardContent>
      </Card>

      {/* 요약 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>슬롯 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary">반당 주간 교시: {slotsPerClass}</Badge>
            <Badge variant="secondary">총 가용 슬롯: {totalSlots}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
