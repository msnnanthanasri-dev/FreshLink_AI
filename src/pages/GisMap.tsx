import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useNavigate, useSearchParams } from "react-router";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "@/convex/_generated/api";
import { AppLayout, PageLoading } from "@/components/AppLayout";
import { fmtQty, dateKeyToLabel, time24to12 } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Truck, MapPin, Layers } from "lucide-react";

const CENTER: [number, number] = [52.47, -1.9];

function makeIcon(emoji: string, ring: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#fff;border:2px solid ${ring};box-shadow:0 2px 8px rgba(18,40,26,.3);font-size:15px">${emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

const supplierIcon = makeIcon("🟢", "#1e4d2b");
const recipientIcon = makeIcon("🔵", "#2563eb");
const foodIcon = makeIcon("🍎", "#ff6b4a");
const pickupIcon = makeIcon("🟠", "#e9b44c");

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(points).pad(0.2));
    }
  }, [map, points]);
  return null;
}

export default function GisMap() {
  const data = useQuery(api.insights.mapData, {});
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const navigate = useNavigate();
  const [showSuppliers, setShowSuppliers] = useState(true);
  const [showRecipients, setShowRecipients] = useState(true);
  const [showFood, setShowFood] = useState(true);
  const [showPickups, setShowPickups] = useState(true);
  const [urgentOnly, setUrgentOnly] = useState(false);

  // All hooks must run before any early return so hook order stays stable.
  const pickups = useMemo(
    () =>
      (data?.pickups ?? []).filter((p) => {
        const isUrgent = p.scheduledDate <= new Date().toISOString().slice(0, 10);
        return !urgentOnly || isUrgent;
      }),
    [data, urgentOnly],
  );

  const routes = useMemo(
    () =>
      pickups.map((p) => ({
        id: p._id,
        positions: [
          [p.supplier.lat, p.supplier.lng],
          [p.recipient.lat, p.recipient.lng],
        ] as [number, number][],
        label: `${p.supplier.name} → ${p.recipient.name}`,
        quantity: `${fmtQty(p.quantity, p.unit)}`,
        when: `${dateKeyToLabel(p.scheduledDate)} · ${time24to12(p.scheduledTime)}`,
        status: p.status,
      })),
    [pickups],
  );

  const focused = focusId ? routes.find((r) => r.id === focusId) ?? null : null;

  const allPoints: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [];
    if (!data) return pts;
    if (showSuppliers) data.orgs.filter((o) => o.type === "supplier").forEach((o) => pts.push([o.lat, o.lng]));
    if (showRecipients) data.orgs.filter((o) => o.type === "recipient").forEach((o) => pts.push([o.lat, o.lng]));
    if (showFood) data.listings.forEach((l) => pts.push([l.lat, l.lng]));
    focused?.positions.forEach((p) => pts.push(p));
    return pts;
  }, [data, showSuppliers, showRecipients, showFood, focused]);

  if (data === undefined) {
    return (
      <AppLayout title="GIS Map">
        <PageLoading />
      </AppLayout>
    );
  }

  const filterBtn = (label: string, active: boolean, toggle: () => void, dot: string) => (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "border-forest bg-forest text-white" : "bg-card text-muted-foreground",
      )}
    >
      <span className="size-2 rounded-full" style={{ background: active ? dot : "#c4c0b4" }} />
      {label}
    </button>
  );

  return (
    <AppLayout title="GIS Map" subtitle="Suppliers, recipients, live surplus and pickup routes across the network.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filterBtn("Suppliers", showSuppliers, () => setShowSuppliers((v) => !v), "#1e4d2b")}
        {filterBtn("Recipients", showRecipients, () => setShowRecipients((v) => !v), "#2563eb")}
        {filterBtn("Food", showFood, () => setShowFood((v) => !v), "#ff6b4a")}
        {filterBtn("Upcoming Pickup", showPickups, () => setShowPickups((v) => !v), "#e9b44c")}
        {filterBtn("Urgent (today)", urgentOnly, () => setUrgentOnly((v) => !v), "#ff6b4a")}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-2xl border shadow-sm" style={{ position: "relative", zIndex: 0 }}>
          <MapContainer center={CENTER} zoom={12} className="h-[520px] w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={allPoints} />
            {showSuppliers &&
              data.orgs.filter((o) => o.type === "supplier").map((o) => (
                <Marker key={o._id} position={[o.lat, o.lng]} icon={supplierIcon}>
                  <Popup>
                    <strong>🟢 {o.name}</strong>
                    <br />
                    {o.category} · {o.address}
                  </Popup>
                </Marker>
              ))}
            {showRecipients &&
              data.orgs.filter((o) => o.type === "recipient").map((o) => (
                <Marker key={o._id} position={[o.lat, o.lng]} icon={recipientIcon}>
                  <Popup>
                    <strong>🔵 {o.name}</strong>
                    <br />
                    {o.category} · {o.address}
                  </Popup>
                </Marker>
              ))}
            {showFood &&
              data.listings.map((l) => (
                <Marker key={l._id} position={[l.lat, l.lng]} icon={foodIcon}>
                  <Popup>
                    <strong>{l.title}</strong>
                    <br />
                    {fmtQty(l.quantity, l.unit)} · {l.supplierName}
                    <br />
                    <a href={`/surplus/${l._id}`}>Open listing</a>
                  </Popup>
                </Marker>
              ))}
            {showPickups &&
              pickups.map((p) => (
                <Marker key={p._id} position={[p.supplier.lat, p.supplier.lng]} icon={pickupIcon}>
                  <Popup>
                    <strong>🟠 In transit / scheduled</strong>
                    <br />
                    {p.supplier.name} {p.supplier.fssaiVerified ? "✓" : ""} → {p.recipient.name} {p.recipient.fssaiVerified ? "✓" : ""}
                    <br />
                    {p.quantity} {p.unit} · {dateKeyToLabel(p.scheduledDate)} {time24to12(p.scheduledTime)}
                    <br />
                    <a href={`/pickups/${p._id}`}>View pickup</a>
                  </Popup>
                </Marker>
              ))}
            {showPickups &&
              routes.map((r) => (
                <Polyline key={r.id} positions={r.positions} pathOptions={{ color: "#4a7c59", weight: 2.5, dashArray: "6 8", opacity: focused?.id === r.id ? 0.95 : 0.5 }} />
              ))}
          </MapContainer>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border bg-ivory p-3 text-xs text-muted-foreground">
            <Layers className="size-4 text-leaf" />
            🟢 Supplier → 🟠 Pickup → 🔵 Recipient. Dashed green lines are live pickup routes.
          </div>
          {routes.length === 0 && (
            <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              No upcoming pickup routes. Approved allocations appear here automatically.
            </div>
          )}
          {routes.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/pickups/${r.id}`)}
              className={cn(
                "card-hover w-full rounded-xl border bg-card p-4 text-left",
                focused?.id === r.id && "border-coral ring-1 ring-coral/40",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Truck className="size-4 text-leaf" /> {r.label}
                </span>
                <span className="rounded-full bg-harvest/15 px-2 py-0.5 text-[10px] font-bold text-[#8a6414]">{r.status.replace(/_/g, " ")}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.quantity} · {r.when}
              </p>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
