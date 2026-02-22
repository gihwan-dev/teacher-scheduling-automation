import { useMemo } from 'react'
import { predictHourShortageFromCalendarChange } from '@/features/analyze-schedule-impact'
import { useSetupStore } from '@/features/manage-school-setup'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function HourShortageReport() {
  const {
    schoolConfig,
    teachers,
    latestSnapshot,
    baselineAcademicCalendarEvents,
    academicCalendarEvents,
  } = useSetupStore()

  const report = useMemo(() => {
    if (!schoolConfig || !latestSnapshot) {
      return null
    }
    return predictHourShortageFromCalendarChange({
      beforeEvents: baselineAcademicCalendarEvents,
      afterEvents: academicCalendarEvents,
      schoolConfig,
      teachers,
      snapshot: latestSnapshot,
    })
  }, [
    schoolConfig,
    latestSnapshot,
    baselineAcademicCalendarEvents,
    academicCalendarEvents,
    teachers,
  ])

  if (!schoolConfig || !latestSnapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">시수 부족 예측</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          예측을 위해 생성된 시간표 스냅샷이 필요합니다. 먼저 시간표를 생성해
          주세요.
        </CardContent>
      </Card>
    )
  }

  if (!report || report.shortageByClass.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">시수 부족 예측</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          현재 학사일정 변경으로 인한 부족 시수 증가가 없습니다.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          시수 부족 예측
          <span className="text-xs font-normal text-muted-foreground ml-2">
            기준 주차: {report.weekTag}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">학급</TableHead>
              <TableHead className="w-[110px]">요구 시수</TableHead>
              <TableHead className="w-[110px]">변경 전 가능</TableHead>
              <TableHead className="w-[110px]">변경 후 가능</TableHead>
              <TableHead className="w-[120px]">부족 증가</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.shortageByClass.map((item) => (
              <TableRow key={`${item.grade}-${item.classNumber}`}>
                <TableCell>
                  {item.grade}학년 {item.classNumber}반
                </TableCell>
                <TableCell>{item.requiredHours}</TableCell>
                <TableCell>{item.availableBefore}</TableCell>
                <TableCell>{item.availableAfter}</TableCell>
                <TableCell className="text-destructive">
                  +{item.deltaShortage}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="space-y-2">
          <p className="text-sm font-medium">보강 추천</p>
          <ul className="space-y-1 text-sm">
            {report.recommendations.map((recommendation, index) => (
              <li key={`${recommendation.grade}-${recommendation.classNumber}-${index}`}>
                {recommendation.message}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
