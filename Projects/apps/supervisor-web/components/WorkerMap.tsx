"use client";

import { useEffect, useRef } from "react";

type WorkerLocation = {
  id: string;
  userEmail: string;
  userName?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  siteId?: string;
  timestamp: string;
};

type Props = { locations: WorkerLocation[]; height?: number };

function minutesAgo(ts: string) {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
}

export default function WorkerMap({ locations, height = 480 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<unknown>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Dynamically import leaflet to avoid SSR issues
    Promise.all([
      import("leaflet"),
      // @ts-expect-error no types needed here
      import("leaflet/dist/leaflet.css"),
    ]).then(([L]) => {
      if (!mapRef.current) return;

      // Default to ANZ region if no locations
      const centre: [number, number] = locations.length > 0
        ? [
            locations.reduce((s, l) => s + l.latitude, 0) / locations.length,
            locations.reduce((s, l) => s + l.longitude, 0) / locations.length,
          ]
        : [-33.87, 151.21]; // Sydney

      if (!leafletMap.current) {
        const map = (L as typeof import("leaflet")).map(mapRef.current, { zoomControl: true });
        (L as typeof import("leaflet")).tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);
        map.setView(centre, locations.length > 0 ? 13 : 5);
        leafletMap.current = map;
      }

      const map = leafletMap.current as import("leaflet").Map;

      // Remove old markers layer
      map.eachLayer((layer) => {
        if ((layer as unknown as { _sitesnap?: boolean })._sitesnap) map.removeLayer(layer);
      });

      locations.forEach((loc) => {
        const mins = minutesAgo(loc.timestamp);
        const freshColor = mins < 10 ? "#22C55E" : mins < 60 ? "#F59E0B" : "#9EAFC2";
        const initials = (loc.userName ?? loc.userEmail).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

        const icon = (L as typeof import("leaflet")).divIcon({
          className: "",
          html: `<div style="
            width:40px;height:40px;border-radius:50%;
            background:${freshColor};border:3px solid #fff;
            box-shadow:0 2px 8px rgba(0,0,0,0.25);
            display:flex;align-items:center;justify-content:center;
            font-weight:700;font-size:14px;color:#fff;
            font-family:-apple-system,sans-serif;
          ">${initials}</div>
          <div style="
            position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
            width:0;height:0;border-left:6px solid transparent;
            border-right:6px solid transparent;border-top:8px solid ${freshColor};
          "></div>`,
          iconSize: [40, 48],
          iconAnchor: [20, 48],
          popupAnchor: [0, -52],
        });

        const marker = (L as typeof import("leaflet")).marker([loc.latitude, loc.longitude], { icon });
        (marker as unknown as { _sitesnap: boolean })._sitesnap = true;

        marker.bindPopup(`
          <div style="font-family:-apple-system,sans-serif;min-width:180px;">
            <div style="font-weight:700;font-size:14px;color:#0F2B46;margin-bottom:4px;">
              ${loc.userName ?? loc.userEmail}
            </div>
            <div style="font-size:12px;color:#6B7C93;margin-bottom:2px;">
              📍 ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}
            </div>
            ${loc.accuracy ? `<div style="font-size:12px;color:#6B7C93;margin-bottom:2px;">±${Math.round(loc.accuracy)}m accuracy</div>` : ""}
            <div style="font-size:12px;margin-top:6px;padding:4px 8px;border-radius:6px;display:inline-block;background:${freshColor}22;color:${freshColor};font-weight:600;">
              ${mins < 1 ? "Just now" : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`}
            </div>
          </div>
        `);
        marker.addTo(map);
      });

      if (locations.length > 1) {
        const bounds = (L as typeof import("leaflet")).latLngBounds(locations.map((l) => [l.latitude, l.longitude] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }).catch(console.error);

    return () => {
      if (leafletMap.current) {
        (leafletMap.current as import("leaflet").Map).remove();
        leafletMap.current = null;
      }
    };
  }, []);

  // Update markers when locations change without re-creating the map
  useEffect(() => {
    if (!leafletMap.current) return;
    import("leaflet").then((L) => {
      const map = leafletMap.current as import("leaflet").Map;
      map.eachLayer((layer) => {
        if ((layer as unknown as { _sitesnap?: boolean })._sitesnap) map.removeLayer(layer);
      });
      locations.forEach((loc) => {
        const mins = minutesAgo(loc.timestamp);
        const freshColor = mins < 10 ? "#22C55E" : mins < 60 ? "#F59E0B" : "#9EAFC2";
        const initials = (loc.userName ?? loc.userEmail).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:40px;height:40px;border-radius:50%;background:${freshColor};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;font-family:-apple-system,sans-serif;">${initials}</div><div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${freshColor};"></div>`,
          iconSize: [40, 48],
          iconAnchor: [20, 48],
          popupAnchor: [0, -52],
        });
        const marker = L.marker([loc.latitude, loc.longitude], { icon });
        (marker as unknown as { _sitesnap: boolean })._sitesnap = true;
        marker.bindPopup(`<div style="font-family:-apple-system,sans-serif;min-width:180px;"><div style="font-weight:700;font-size:14px;color:#0F2B46;margin-bottom:4px;">${loc.userName ?? loc.userEmail}</div><div style="font-size:12px;color:#6B7C93;">📍 ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}</div><div style="font-size:12px;margin-top:6px;padding:4px 8px;border-radius:6px;display:inline-block;background:${freshColor}22;color:${freshColor};font-weight:600;">${mins < 1 ? "Just now" : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`}</div></div>`);
        marker.addTo(map);
      });
    }).catch(console.error);
  }, [locations]);

  return (
    <div
      ref={mapRef}
      style={{
        height,
        width: "100%",
        borderRadius: 14,
        overflow: "hidden",
        background: "#EEF2F7",
        zIndex: 0,
      }}
    />
  );
}
