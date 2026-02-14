export interface CompactSchool {
  g: number // gradeCount
  c: Record<number, number> // classCountByGrade
  d: Array<number> // activeDays as indices
  p: number // periodsPerDay
}

export interface CompactSubject {
  n: string // name
  a: string // abbreviation
  t: number // track index
}

export interface CompactTeacher {
  n: string // name
  s: Array<number> // subject indices
  h: number // baseHoursPerWeek
  ca: Array<[number, number, number]> // classAssignments: [grade, classNumber, hoursPerWeek]
}

export interface CompactCell {
  i: number // flat index
  t: number // teacher index
  s: number // subject index
  f: number // flags bitfield: (statusIndex << 1) | (isFixed ? 1 : 0)
}

export interface CompactPolicy {
  sc: number // studentMaxConsecutiveSameSubject
  tc: number // teacherMaxConsecutiveHours
  td: number // teacherMaxDailyHours
}

export interface CompactTeacherPolicy {
  ti: number // teacher index
  av: Array<[number, number]> // avoidanceSlots: [dayIndex, period]
  tp: number // timePreference index
  mco: number | null // maxConsecutiveHoursOverride
  mdo: number | null // maxDailyHoursOverride
}

export interface SharePayload {
  v: number
  meta: { score: number; genMs: number; ts: string }
  school: CompactSchool
  subjects: Array<CompactSubject>
  teachers: Array<CompactTeacher>
  grid: Array<CompactCell>
  policy: CompactPolicy
  teacherPolicies: Array<CompactTeacherPolicy>
}
