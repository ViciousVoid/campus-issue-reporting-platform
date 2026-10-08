import type { CampusIssue, Category, IssueStatus } from '@/lib/campus'

const SAMPLE_POSTS: {
  title: string
  description: string
  category: string
  location: string
  buildingArea: string
  status: IssueStatus
  upvotes: number
  minutesAgo: number
}[] = [
  { title: 'Wi-Fi drops during afternoon lectures', description: 'The connection keeps dropping in the west lecture wing, especially when the rooms are full. It is making online quizzes difficult to complete.', category: 'Wi-Fi / Network', location: 'West Lecture Wing', buildingArea: 'Level 2', status: 'reported', upvotes: 9, minutesAgo: 8 },
  { title: 'More lights needed along the library path', description: 'The path between the library and residence gets very dark after evening study hours. A few extra lights would make the walk safer.', category: 'Security', location: 'Central Library', buildingArea: 'South walkway', status: 'acknowledged', upvotes: 18, minutesAgo: 16 },
  { title: 'Projector image is too dim in Room 204', description: 'The projector has been difficult to read from the back rows for the past week. Could the bulb or focus be checked before the next lecture?', category: 'Classroom', location: 'Science Block', buildingArea: 'Room 204', status: 'in_progress', upvotes: 27, minutesAgo: 26 },
  { title: 'Long queue at the evening dining hall', description: 'The serving line regularly stretches outside during the dinner rush. Opening one additional counter for the busiest half hour could help.', category: 'Food / Mess', location: 'North Dining Hall', buildingArea: 'Main counter', status: 'reported', upvotes: 42, minutesAgo: 34 },
  { title: 'Water cooler near the studios is out of order', description: 'The cooler has not dispensed cold water since Monday. The nearest working one is several buildings away.', category: 'Other', location: 'Arts Studios', buildingArea: 'Ground floor', status: 'acknowledged', upvotes: 56, minutesAgo: 43 },
  { title: 'Shuttle timetable is missing from the stop', description: 'The printed schedule at the south entrance has faded away, so it is hard to know when the last evening shuttle leaves.', category: 'Transport', location: 'Main Gate', buildingArea: 'South entrance stop', status: 'reported', upvotes: 13, minutesAgo: 52 },
  { title: 'Washroom taps are leaking in the east wing', description: 'Two taps keep running after they are turned off. It is a small fix that could save a lot of water throughout the day.', category: 'Washroom', location: 'East Residence', buildingArea: 'Second floor', status: 'in_progress', upvotes: 35, minutesAgo: 61 },
  { title: 'Lab benches need more working power outlets', description: 'Several outlets along the back benches are not supplying power. Students are sharing extension leads during practical sessions.', category: 'Laboratory', location: 'Engineering Lab', buildingArea: 'Bench row C', status: 'reported', upvotes: 48, minutesAgo: 74 },
  { title: 'Basketball court lights switch off too early', description: 'The court lights turn off before the posted closing time, leaving evening practice in the dark. Please check the timer.', category: 'Sports', location: 'Outdoor Courts', buildingArea: 'Court 1', status: 'acknowledged', upvotes: 22, minutesAgo: 86 },
  { title: 'Hostel laundry machines need a service check', description: 'Two machines stop midway through a cycle and leave clothes soaked. A maintenance check would get the laundry room back to full capacity.', category: 'Hostel', location: 'Maple Residence', buildingArea: 'Laundry room', status: 'reported', upvotes: 64, minutesAgo: 98 },
]

export function createDemoIssues(campusId: string, categories: Category[]): CampusIssue[] {
  if (!campusId) return []

  const now = Date.now()
  return SAMPLE_POSTS.map((post, index) => {
    const category = categories.find((item) => item.name === post.category)
    return {
      id: `trial-sample-${index + 1}`,
      campus_id: campusId,
      reporter_id: null,
      category_id: category?.id ?? '',
      location_id: null,
      department_id: null,
      title: post.title,
      description: post.description,
      building_area: post.buildingArea,
      faculty_tag: null,
      anonymous_public: true,
      status: post.status,
      severity: 'medium',
      moderation_status: 'approved',
      moderation_reason: null,
      duplicate_of: null,
      custom_category: null,
      custom_location: null,
      custom_department: null,
      problem_type: null,
      assigned_to: null,
      resolved_at: null,
      resolution_verification: null,
      ai_summary: null,
      ai_summary_updated_at: null,
      demoOnly: true,
      created_at: new Date(now - post.minutesAgo * 60_000).toISOString(),
      updated_at: new Date(now - post.minutesAgo * 60_000).toISOString(),
      category: category ? { name: category.name, icon: category.icon, color: category.color } : { name: post.category, icon: 'circle-help', color: 'slate' },
      location: { name: post.location, building: post.buildingArea },
      department: null,
      reporter: null,
      media: [],
      votes: Array.from({ length: post.upvotes }, (_, voteIndex) => ({ value: 1, user_id: `trial-vote-${index + 1}-${voteIndex + 1}` })),
      affected_users: [],
      followers: [],
      comments: [],
    }
  })
}
