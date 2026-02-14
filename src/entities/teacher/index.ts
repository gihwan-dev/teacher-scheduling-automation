export type { Teacher, ClassHoursAssignment } from './model/types'
export { teacherSchema, classHoursAssignmentSchema } from './model/schema'
export {
  validateHoursConsistency,
  validateClassCapacity,
  findUnassignedSubjects,
} from './lib/validator'
