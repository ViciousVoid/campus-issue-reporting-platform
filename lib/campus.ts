export type Campus = {
  id: string
  name: string
  city: string
  region: string
  slug: string
}

export type Category = {
  id: string
  name: string
  icon: string
  color: string
}

export type CampusIssue = {
  id: string
  campus_id: string
  reporter_id: string | null
  category_id: string
  location_id: string | null
  department_id: string | null
  title: string
  description: string
  building_area: string | null
  faculty_tag: string | null
  anonymous_public: boolean
  status: IssueStatus
  created_at: string
  updated_at: string
  category: { name: string; icon: string; color: string } | null
  location: { name: string; building: string | null } | null
  department: { name: string } | null
  reporter: { display_name: string; avatar_url: string | null } | null
  media: { storage_path: string; display_order: number }[]
  votes: { value: number }[]
  affected_users: { user_id: string }[]
  comments: { id: string }[]
}

export type IssueStatus =
  | 'reported'
  | 'verified'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'reopened'

export type AppView = 'home' | 'explore' | 'activity' | 'profile'

export const ISSUE_STATUSES: IssueStatus[] = [
  'reported',
  'verified',
  'acknowledged',
  'in_progress',
  'resolved',
]

export const STATUS_LABELS: Record<IssueStatus, string> = {
  reported: 'Reported',
  verified: 'Verified',
  acknowledged: 'Acknowledged',
  in_progress: 'In progress',
  resolved: 'Resolved',
  reopened: 'Reopened',
}

export const CATEGORY_IMAGES: Record<string, string> = {
  'Wi-Fi / Network': 'photo-1498050108023-c5249f4df085',
  Hostel: 'photo-1555854877-bab0e564b8d5',
  'Food / Mess': 'photo-1555396273-367ea4eb4db5',
  Electricity: 'photo-1497366754035-f200968a6e72',
  Transport: 'photo-1517245386807-bb43f82c33c4',
  Library: 'photo-1507842217343-583bb7270b66',
  Classroom: 'photo-1562774053-701939374585',
  Laboratory: 'photo-1581093458791-9d42e3c1a998',
  Washroom: 'photo-1584622650111-993a426fbf0a',
  Sports: 'photo-1461896836934-ffe607ba8211',
  Security: 'photo-1563013544-824ae1b704d3',
  Administration: 'photo-1497366754035-f200968a6e72',
  Other: 'photo-1523050854058-8df90110c9f1',
}
