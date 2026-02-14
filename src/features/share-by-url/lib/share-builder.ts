import {
  loadAllSetupData,
  loadConstraintPolicy,
  loadLatestTimetableSnapshot,
  loadTeacherPolicies,
} from '@/shared/persistence/indexeddb/repository'
import { URL_LENGTH_MAX, buildSharePayload, compressToUrl } from '@/shared/lib/url'

export interface ShareBuildResult {
  url: string
  urlLength: number
}

export async function buildShareUrl(): Promise<ShareBuildResult> {
  const [setupData, snapshot, constraintPolicy, teacherPolicies] = await Promise.all([
    loadAllSetupData(),
    loadLatestTimetableSnapshot(),
    loadConstraintPolicy(),
    loadTeacherPolicies(),
  ])

  if (!snapshot) {
    throw new Error('시간표를 먼저 생성해주세요.')
  }

  if (!setupData.schoolConfig) {
    throw new Error('학교 설정이 없습니다.')
  }

  if (!constraintPolicy) {
    throw new Error('제약 정책이 없습니다.')
  }

  const payload = buildSharePayload(
    setupData.schoolConfig,
    setupData.subjects,
    setupData.teachers,
    snapshot,
    constraintPolicy,
    teacherPolicies,
  )

  const json = JSON.stringify(payload)
  const compressed = compressToUrl(json)

  const url = `${window.location.origin}/share#data=${compressed}`

  if (url.length > URL_LENGTH_MAX) {
    throw new Error('공유 링크가 너무 깁니다.')
  }

  return { url, urlLength: url.length }
}
