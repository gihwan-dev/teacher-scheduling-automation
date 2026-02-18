export type { Teacher, TeachingAssignment } from './model/types'
export {
  teacherSchema,
  teachingAssignmentSchema,
  legacyClassHoursAssignmentSchema,
} from './model/schema'
export {
  validateHoursConsistency,
  validateClassCapacity,
  findUnassignedSubjects,
  getTeacherAssignments,
} from './lib/validator'
