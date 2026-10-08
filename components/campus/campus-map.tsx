'use client'

import dynamic from 'next/dynamic'
import type { CampusIssue } from '@/lib/campus'

export type MapPoint = { latitude: number; longitude: number }
export type CampusMapProps = {
  issues: CampusIssue[]
  selectedPoint?: MapPoint | null
  onPointSelect?: (point: MapPoint) => void
  onIssueSelect?: (issue: CampusIssue) => void
  className?: string
}

const CampusMap = dynamic<CampusMapProps>(() => import('@/components/campus/campus-map-client').then((module) => module.CampusMapClient), {
  ssr: false,
  loading: () => <div className="campus-map-loading" role="status">Loading campus map…</div>,
})

export { CampusMap }
export default CampusMap
