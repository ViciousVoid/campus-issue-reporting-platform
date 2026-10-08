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

const CampusIssueMap = dynamic(() => import('@/components/campus/leaflet-map').then((module) => module.CampusIssueMap), {
  ssr: false,
  loading: () => <div className="map-loading" role="status">Loading campus map…</div>,
})

const LocationPickerMap = dynamic(() => import('@/components/campus/leaflet-map').then((module) => module.LocationPickerMap), {
  ssr: false,
  loading: () => <div className="map-loading picker-loading" role="status">Preparing location picker…</div>,
})

export function CampusMap({ issues, selectedPoint, onPointSelect, onIssueSelect, className = '' }: CampusMapProps) {
  if (onPointSelect) {
    return <div className={className}><LocationPickerMap selected={selectedPoint ?? null} onSelect={onPointSelect} /></div>
  }

  return <div className={className}><CampusIssueMap issues={issues} onSelectIssue={(issueId) => {
    const issue = issues.find((item) => item.id === issueId)
    if (issue) onIssueSelect?.(issue)
  }} /></div>
}

export default CampusMap
