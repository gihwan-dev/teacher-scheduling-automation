export type { TeacherPolicy, AvoidanceSlot, TimePreference } from './model/types'
export { teacherPolicySchema, avoidanceSlotSchema, timePreferenceSchema } from './model/schema'
export { validateTeacherPolicy, validateAllPolicies } from './lib/validator'
export type { PolicyValidationMessage } from './lib/validator'
