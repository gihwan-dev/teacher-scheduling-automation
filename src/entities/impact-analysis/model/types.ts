import type { WeekTag } from '@/shared/lib/week-tag'

export type ImpactRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface ImpactTeacherSummary {
  teacherName: string
  summary: string
}

export interface ImpactClassSummary {
  grade: number
  classNumber: number
  summary: string
}

export interface ImpactHourDelta {
  target: string
  delta: number
}

export interface ImpactAnalysisReport {
  id: string
  snapshotId: string
  weekTag: WeekTag
  affectedTeachers: Array<ImpactTeacherSummary>
  affectedClasses: Array<ImpactClassSummary>
  hourDelta: Array<ImpactHourDelta>
  riskLevel: ImpactRiskLevel
  alternatives: Array<string>
  createdAt: string
}

export interface HourShortageByClass {
  grade: number
  classNumber: number
  requiredHours: number
  availableBefore: number
  availableAfter: number
  shortageBefore: number
  shortageAfter: number
  deltaShortage: number
}

export interface HourShortageRecommendation {
  grade: number
  classNumber: number
  message: string
}

export interface HourShortagePredictionReport {
  weekTag: WeekTag
  generatedAt: string
  shortageByClass: Array<HourShortageByClass>
  recommendations: Array<HourShortageRecommendation>
}
