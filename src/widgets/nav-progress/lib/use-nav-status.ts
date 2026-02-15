import { useEffect, useState } from 'react'
import {
  loadLatestTimetableSnapshot,
  loadSchoolConfig,
  loadTeacherPolicies,
} from '@/shared/persistence/indexeddb/repository'

interface NavStatus {
  setupDone: boolean
  policyDone: boolean
  generateDone: boolean
}

export function useNavStatus(): NavStatus {
  const [status, setStatus] = useState<NavStatus>({
    setupDone: false,
    policyDone: false,
    generateDone: false,
  })

  useEffect(() => {
    Promise.all([
      loadSchoolConfig(),
      loadTeacherPolicies(),
      loadLatestTimetableSnapshot(),
    ]).then(([config, policies, snapshot]) => {
      setStatus({
        setupDone: config !== undefined,
        policyDone: policies.length > 0,
        generateDone: snapshot !== undefined,
      })
    })
  }, [])

  return status
}
