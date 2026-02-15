import type { TimetableCell } from '@/entities/timetable'
import type { Teacher } from '@/entities/teacher'
import type { Subject } from '@/entities/subject'
import type { SchoolConfig } from '@/entities/school'
import { ReadOnlyTimetableView } from '@/widgets/readonly-timetable-view'

interface TimetableViewProps {
  cells: Array<TimetableCell>
  schoolConfig: SchoolConfig
  teachers: Array<Teacher>
  subjects: Array<Subject>
}

export function TimetableView({
  cells,
  schoolConfig,
  teachers,
  subjects,
}: TimetableViewProps) {
  return (
    <ReadOnlyTimetableView
      cells={cells}
      schoolConfig={schoolConfig}
      teachers={teachers}
      subjects={subjects}
    />
  )
}
