export type {
  Teacher,
  TeachingAssignment,
  ClassHoursAssignment,
  HomeroomAssignment,
} from './model/types'
export {
  teacherSchema,
  teachingAssignmentSchema,
  legacyClassHoursAssignmentSchema,
  classHoursAssignmentSchema,
  homeroomAssignmentSchema,
} from './model/schema'
export {
  validateHoursConsistency,
  validateClassCapacity,
  findUnassignedSubjects,
  getTeacherAssignments,
} from './lib/validator'
