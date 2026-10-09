import { useEffect, useState } from "react";
import { useIndicesSelector, latestAsOf } from "../lib/indicesStream";

// "updated Xs ago" next to Live Prices, from the freshest indices[].as_of.
// Owns its own 1 s clock so the parent never re-renders for it.
export function UpdatedAgo({ color }: { color: string }) {
  const indices = useIndicesSelector(s => s.indices);
  const live = useIndicesSelector(s => s.live);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const asOf = latestAsOf(indices);
  if (asOf === null) return null;

  const secs = Math.max(0, Math.round((now - asOf) / 1000));
  const label = secs < 60 ? `${secs}s` : secs < 3600 ? `${Math.floor(secs / 60)}m` : `${Math.floor(secs / 3600)}h`;

  return (
    <span
      title={live ? "Live stream connected" : "Live stream reconnecting"}
      style={{ marginLeft: "auto", fontSize: "10px", color, fontVariantNumeric: "tabular-nums" }}
    >
      updated {label} ago{live ? "" : " · reconnecting"}
    </span>
  );
}
