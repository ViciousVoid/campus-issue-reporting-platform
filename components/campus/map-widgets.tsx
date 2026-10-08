'use client'

import dynamic from 'next/dynamic'
import type { Coordinates } from '@/components/campus/leaflet-map'


const LocationPickerMap = dynamic(() => import('@/components/campus/leaflet-map').then((module) => module.LocationPickerMap), {
  ssr: false,
  loading: () => <div className="map-loading picker-loading" role="status">Preparing location picker…</div>,
})

export function LocationMapWidget({ selected, onSelect, initialCenter }: {
  selected: Coordinates | null
  onSelect: (coordinates: Coordinates) => void
  initialCenter?: Coordinates | null
}) {
  return <LocationPickerMap selected={selected} onSelect={onSelect} initialCenter={initialCenter} />
}

export type { Coordinates }
