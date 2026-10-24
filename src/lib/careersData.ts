import careersContent from '../data/careersContent.json'

export type JobDepartment = 'All' | 'Engineering' | 'Sales' | 'Marketing' | 'Business Development' | 'Internships'
export type EmploymentType = 'Full-time' | 'Internship' | 'Full-time & Internship'

export interface JobRole {
  id: string
  slug: string
  title: string
  department: 'Engineering' | 'Sales' | 'Marketing' | 'Business Development'
  employmentType: EmploymentType
  openForInterns: boolean
  location: string
  experience: string
  summary: string
  overview: string
  responsibilities: string[]
  requirements: string[]
  niceToHave: string[]
  learnings: string[]
  workArrangement: string
  skills: string[]
  status: 'active' | 'closed'
}

export const JOB_ROLES: JobRole[] = careersContent.JOB_ROLES as JobRole[]
export const CULTURE_PILLARS = careersContent.CULTURE_PILLARS
export const WHY_EBEXTA_POINTS = careersContent.WHY_EBEXTA_POINTS

