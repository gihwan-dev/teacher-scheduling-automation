import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGenerateStore } from '@/features/generate-timetable/model/store'

export function ConstraintConfigForm() {
  const { constraintPolicy, setConstraintPolicy } = useGenerateStore()

  return (
    <Card>
      <CardHeader>
        <CardTitle>제약 설정</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="studentMaxConsecutive">
              학생 동일과목 최대 연강
            </Label>
            <Input
              id="studentMaxConsecutive"
              type="number"
              min={1}
              max={10}
              value={constraintPolicy.studentMaxConsecutiveSameSubject}
              onChange={(e) =>
                setConstraintPolicy({
                  studentMaxConsecutiveSameSubject: Number(e.target.value) || 1,
                })
              }
            />
            <p className="text-muted-foreground text-xs">
              같은 반에서 동일 과목이 연속 배치되는 최대 교시 수
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacherMaxConsecutive">교사 최대 연속 수업</Label>
            <Input
              id="teacherMaxConsecutive"
              type="number"
              min={1}
              max={10}
              value={constraintPolicy.teacherMaxConsecutiveHours}
              onChange={(e) =>
                setConstraintPolicy({
                  teacherMaxConsecutiveHours: Number(e.target.value) || 1,
                })
              }
            />
            <p className="text-muted-foreground text-xs">
              교사가 연속으로 수업하는 최대 교시 수
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacherMaxDaily">교사 일일 최대 시수</Label>
            <Input
              id="teacherMaxDaily"
              type="number"
              min={1}
              max={10}
              value={constraintPolicy.teacherMaxDailyHours}
              onChange={(e) =>
                setConstraintPolicy({
                  teacherMaxDailyHours: Number(e.target.value) || 1,
                })
              }
            />
            <p className="text-muted-foreground text-xs">
              교사가 하루에 수업하는 최대 시수
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
