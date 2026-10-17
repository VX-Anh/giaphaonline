'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type * as Leaflet from 'leaflet';
import { useEffect, useRef } from 'react';
import { directionsUrl, KIND_META, Place } from '@/lib/places';

interface Props {
  places: Place[];
  familyId: string;
  /** Điểm đang được chọn khi thêm địa điểm mới */
  picked?: { lat: number; lng: number } | null;
  onPick?: (p: { lat: number; lng: number }) => void;
  /** Bay tới và mở popup của một điểm; tăng seq để lặp lại với cùng một điểm */
  focus?: { id: string; seq: number } | null;
  className?: string;
}

const VN_CENTER: [number, number] = [16.2, 106.3];
const COARSE_RADIUS_M = 6000;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Bản đồ Leaflet + OpenStreetMap (có lớp ảnh vệ tinh). Leaflet chỉ chạy trên trình duyệt
 * nên được nạp động trong useEffect.
 */
export function MapView({ places, familyId, picked, onPick, focus, className = 'h-[480px]' }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  /** Ghim chính xác được gom nhóm; vùng gần đúng (người còn sống) nằm ở lớp riêng */
  const cluster = useRef<Leaflet.MarkerClusterGroup | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const pickLayer = useRef<Leaflet.LayerGroup | null>(null);
  const markers = useRef(new Map<string, Leaflet.Layer & { openPopup(): unknown }>());
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const ready = useRef<Promise<void> | null>(null);

  // Khởi tạo bản đồ một lần
  useEffect(() => {
    let cancelled = false;
    ready.current = (async () => {
      const mod = await import('leaflet');
      const Lf = mod.default ?? (mod as unknown as typeof Leaflet);
      // Plugin gom nhóm gắn vào biến toàn cục L
      (window as unknown as { L: typeof Leaflet }).L = Lf;
      await import('leaflet.markercluster');
      if (cancelled || !el.current) return;
      L.current = Lf;
      const m = Lf.map(el.current, { center: VN_CENTER, zoom: 5, scrollWheelZoom: true });
      const street = Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      const satellite = Lf.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Ảnh vệ tinh &copy; Esri' },
      );
      Lf.control.layers({ 'Bản đồ': street, 'Vệ tinh': satellite }, undefined, { position: 'topright' }).addTo(m);
      Lf.control.scale({ imperial: false }).addTo(m);
      layer.current = Lf.layerGroup().addTo(m);
      cluster.current = Lf.markerClusterGroup({
        maxClusterRadius: 45,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (c) => {
          const n = c.getChildCount();
          const size = n < 10 ? 38 : n < 100 ? 46 : 54;
          return Lf.divIcon({
            className: '',
            html: `<div class="gp-cluster" style="width:${size}px;height:${size}px" aria-label="${n} địa điểm"><span>${n}</span></div>`,
            iconSize: [size, size],
          });
        },
      }).addTo(m);
      pickLayer.current = Lf.layerGroup().addTo(m);
      m.on('click', (e: Leaflet.LeafletMouseEvent) => onPickRef.current?.({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) }));
      map.current = m;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Vẽ lại các điểm khi dữ liệu đổi
  useEffect(() => {
    ready.current?.then(() => {
      const Lf = L.current;
      const m = map.current;
      if (!Lf || !m || !layer.current || !cluster.current) return;
      layer.current.clearLayers();
      cluster.current.clearLayers();
      markers.current.clear();
      const bounds: [number, number][] = [];
      for (const p of places) {
        const meta = KIND_META[p.kind];
        const popup = popupHtml(p, familyId);
        let marker: Leaflet.Layer & { openPopup(): unknown; bindPopup(h: string): unknown };
        if (p.precision === 'coarse') {
          // Người còn sống: chỉ vẽ vùng ~6 km, không có ghim chính xác.
          // Thêm vòng tròn cỡ cố định trên màn hình để vẫn thấy được khi thu nhỏ bản đồ.
          const style = { color: meta.color, weight: 2, dashArray: '6 6' };
          marker = Lf.featureGroup([
            Lf.circle([p.lat, p.lng], { ...style, radius: COARSE_RADIUS_M, fillOpacity: 0.12 }),
            Lf.circleMarker([p.lat, p.lng], { ...style, radius: 12, fillOpacity: 0.25 }),
          ]);
        } else {
          marker = Lf.marker([p.lat, p.lng], {
            icon: Lf.divIcon({
              className: '',
              html: `<div style="background:${meta.color}" class="gp-pin"><span>${meta.symbol}</span></div>`,
              iconSize: [34, 42],
              iconAnchor: [17, 42],
              popupAnchor: [0, -38],
            }),
            title: `${meta.label}: ${p.person?.displayName ?? p.name}`,
            alt: meta.label,
            keyboard: true,
          });
        }
        marker.bindPopup(popup);
        marker.addTo(p.precision === 'coarse' ? layer.current : cluster.current);
        markers.current.set(p.id, marker);
        // Khi đang ghim vị trí mới, chỉ căn theo các điểm chính xác (mộ, nhà thờ họ) để mở sẵn quanh làng
        if (!onPickRef.current || p.precision === 'exact') bounds.push([p.lat, p.lng]);
      }
      if (bounds.length === 1) m.setView(bounds[0], 14);
      else if (bounds.length > 1) m.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    });
  }, [places, familyId]);

  // Điểm đang chọn khi thêm mới
  useEffect(() => {
    ready.current?.then(() => {
      const Lf = L.current;
      if (!Lf || !pickLayer.current || !map.current) return;
      pickLayer.current.clearLayers();
      if (picked) {
        Lf.marker([picked.lat, picked.lng], {
          icon: Lf.divIcon({ className: '', html: '<div class="gp-pin gp-pin-new"><span>+</span></div>', iconSize: [34, 42], iconAnchor: [17, 42] }),
        }).addTo(pickLayer.current);
        if (!map.current.getBounds().contains([picked.lat, picked.lng])) map.current.setView([picked.lat, picked.lng], 16);
      }
    });
  }, [picked]);

  // Bay tới điểm được chọn từ danh sách
  useEffect(() => {
    if (!focus) return;
    ready.current?.then(() => {
      const target = markers.current.get(focus.id);
      const p = places.find((x) => x.id === focus.id);
      if (!target || !p || !map.current) return;
      if (p.precision === 'exact' && cluster.current) {
        // Mở nhóm chứa ghim (phóng to/tách ghim nếu cần) rồi mới mở popup
        cluster.current.zoomToShowLayer(target as Leaflet.Marker, () => target.openPopup());
        return;
      }
      map.current.flyTo([p.lat, p.lng], 11, { duration: 0.8 });
      setTimeout(() => target.openPopup(), 850);
    });
    // Chỉ chạy khi người dùng bấm "xem", không chạy lại khi danh sách điểm đổi
  }, [focus]);

  return (
    <div
      ref={el}
      className={`z-0 w-full overflow-hidden rounded-xl border border-line ${className} ${onPick ? 'cursor-crosshair' : ''}`}
      role="region"
      aria-label="Bản đồ dòng họ"
    />
  );
}

function popupHtml(p: Place, familyId: string): string {
  const meta = KIND_META[p.kind];
  const lines = [`<div class="gp-popup"><p class="gp-kind" style="color:${meta.color}">${meta.label}</p>`];
  if (p.person) {
    lines.push(
      `<a class="gp-name" href="/families/${familyId}/persons/${p.person.id}">${esc(p.person.displayName)}</a>`,
      p.person.generationRecorded ? `<p class="gp-sub">Đời thứ ${p.person.generationRecorded}</p>` : '',
    );
  }
  lines.push(`<p>${esc(p.name)}</p>`);
  if (p.note) lines.push(`<p class="gp-sub">${esc(p.note)}</p>`);
  if (p.precision === 'coarse') lines.push('<p class="gp-sub">Vị trí gần đúng (~10 km) để bảo vệ người còn sống</p>');
  else lines.push(`<a class="gp-dir" href="${directionsUrl(p)}" target="_blank" rel="noopener">Chỉ đường đến đây ↗</a>`);
  lines.push('</div>');
  return lines.join('');
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
