'use client'

import { useEffect, useMemo, useState } from 'react'
import { Crosshair, LoaderCircle } from 'lucide-react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { divIcon, latLngBounds, type LatLngExpression } from 'leaflet'
import type { CampusIssue } from '@/lib/campus'

export type Coordinates = { latitude: number; longitude: number }

const DEFAULT_CENTER: LatLngExpression = [20.5937, 78.9629]
const SEVERITY_COLORS: Record<string, string> = {
  low: '#3b9b67',
  medium: '#d6a21f',
  high: '#ed7140',
  critical: '#c33b46',
}

function MapSizeWatcher() {
  const map = useMap()

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  return null
}

function RecenterMap({ center }: { center: Coordinates }) {
  const map = useMap()

  useEffect(() => {
    map.setView([center.latitude, center.longitude], Math.max(map.getZoom(), 16), { animate: false })
  }, [center, map])

  return null
}

function FitIssueBounds({ issues }: { issues: CampusIssue[] }) {
  const map = useMap()

  useEffect(() => {
    if (!issues.length) return
    if (issues.length === 1) {
      map.setView([issues[0].latitude!, issues[0].longitude!], 16, { animate: false })
      return
    }
    const bounds = latLngBounds(issues.map((issue) => [issue.latitude!, issue.longitude!] as [number, number]))
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16, animate: false })
  }, [issues, map])

  return null
}

function FocusIssue({ issue }: { issue: CampusIssue | null }) {
  const map = useMap()

  useEffect(() => {
    if (issue?.latitude == null || issue.longitude == null) return
    map.setView([issue.latitude, issue.longitude], 18, { animate: true })
  }, [issue, map])

  return null
}

function PinPicker({ selected, onSelect }: { selected: Coordinates | null; onSelect: (coordinates: Coordinates) => void }) {
  useMapEvents({
    click(event) {
      onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    },
  })

  return selected ? <CircleMarker center={[selected.latitude, selected.longitude]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#ed6747', fillOpacity: 1 }} /> : null
}

export function CampusIssueMap({ issues, onSelectIssue, initialCenter, focusedIssueId }: {
  issues: CampusIssue[]
  onSelectIssue: (issueId: string) => void
  initialCenter?: Coordinates | null
  focusedIssueId?: string | null
}) {
  const located = useMemo(() => issues.filter((issue) => issue.latitude != null && issue.longitude != null), [issues])
  const focusedIssue = located.find((issue) => issue.id === focusedIssueId) ?? null
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState(false)
  const icons = useMemo(() => Object.fromEntries(Object.entries(SEVERITY_COLORS).map(([severity, color]) => [severity, divIcon({
    className: 'campus-map-marker-shell',
    html: `<span class="campus-map-marker" style="--marker-color:${color}"><span></span></span>`,
    iconSize: [30, 38],
    iconAnchor: [15, 34],
    popupAnchor: [0, -32],
  })])), [])
  const focusedIcons = useMemo(() => Object.fromEntries(Object.entries(SEVERITY_COLORS).map(([severity, color]) => [severity, divIcon({
    className: 'campus-map-marker-shell is-focused',
    html: `<span class="campus-map-marker" style="--marker-color:${color}"><span></span></span>`,
    iconSize: [38, 46],
    iconAnchor: [19, 42],
    popupAnchor: [0, -38],
  })])), [])

  function centerOnCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError(true)
      return
    }
    setLocating(true)
    setLocationError(false)
    navigator.geolocation.getCurrentPosition(
      ({ coords: current }) => {
        setCurrentLocation({ latitude: current.latitude, longitude: current.longitude })
        setLocating(false)
      },
      () => {
        setLocationError(true)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    )
  }

  return (
    <div className="campus-map-frame">
    <MapContainer className="leaflet-campus-map" center={currentLocation ? [currentLocation.latitude, currentLocation.longitude] : initialCenter ? [initialCenter.latitude, initialCenter.longitude] : DEFAULT_CENTER} zoom={currentLocation || initialCenter ? 16 : 5} scrollWheelZoom zoomControl>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapSizeWatcher />
      {initialCenter && <RecenterMap center={initialCenter} />}
      {currentLocation && <RecenterMap center={currentLocation} />}
      <FitIssueBounds issues={located} />
      <FocusIssue issue={focusedIssue} />
      {located.map((issue) => {
        const severity = issue.severity ?? 'medium'
        const color = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.medium
        return (
          <Marker
            key={issue.id}
            position={[issue.latitude!, issue.longitude!]}
            icon={issue.id === focusedIssueId ? focusedIcons[severity] ?? focusedIcons.medium : icons[severity] ?? icons.medium}
            title={`${severity} issue: ${issue.title}`}
            alt={`${severity} severity issue`}
            eventHandlers={{ click: () => onSelectIssue(issue.id) }}
          >
            <Popup>
              <div className="campus-map-popup">
                <strong>{issue.title}</strong>
                <span style={{ color }}>{severity} severity</span>
                <button type="button" onClick={() => onSelectIssue(issue.id)}>View report</button>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
    <button type="button" className="map-locate-button" onClick={centerOnCurrentLocation} disabled={locating} aria-label="Center map on your current location" title={locationError ? 'Location unavailable; check browser permission' : 'Center on my location'}>{locating ? <LoaderCircle size={15} className="spin" /> : <Crosshair size={15} />}</button>
    {locationError && <span className="map-location-error" role="status">Location unavailable</span>}
    </div>
  )
}

export function LocationPickerMap({ selected, onSelect, initialCenter }: {
  selected: Coordinates | null
  onSelect: (coordinates: Coordinates) => void
  initialCenter?: Coordinates | null
}) {
  const center = useMemo(
    () => selected ?? initialCenter ?? { latitude: 20.5937, longitude: 78.9629 },
    [selected?.latitude, selected?.longitude, initialCenter?.latitude, initialCenter?.longitude],
  )

  return (
    <MapContainer className="leaflet-picker-map" center={[center.latitude, center.longitude]} zoom={selected || initialCenter ? 16 : 5} scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapSizeWatcher />
      <RecenterMap center={center} />
      <PinPicker selected={selected} onSelect={onSelect} />
    </MapContainer>
  )
}

export default CampusIssueMap
