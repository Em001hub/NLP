import React from "react";

const LEGEND_ITEMS = [
  { label: "Person", color: "var(--node-person)", desc: "Named Individuals / Officials" },
  { label: "Organization", color: "var(--node-org)", desc: "Governments, Parties, Corps" },
  { label: "Location", color: "var(--node-loc)", desc: "Cities, States, Regions" },
  { label: "Stat / Casualties", color: "var(--node-stat)", desc: "Numbers, Death Tolls, ₹ / $" },
  { label: "Event", color: "var(--node-event)", desc: "Incidents, Summits, Actions" },
  { label: "Date / Time", color: "var(--node-date)", desc: "Timelines & Anchor Dates" },
  { label: "Misc / Topic", color: "var(--node-misc)", desc: "Key Terms & Concepts" },
];

export default function Legend() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
      }}
    >
      <span className="wire-label" style={{ marginRight: 4, color: "var(--neon-green)" }}>
        NODE CLUSTERS:
      </span>
      {LEGEND_ITEMS.map((item) => (
        <div
          key={item.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 9px",
            borderRadius: 4,
            background: "rgba(10, 18, 25, 0.75)",
            border: `1px solid ${item.color}40`,
            boxShadow: `0 0 6px ${item.color}18`,
          }}
          title={item.desc}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: item.color,
              boxShadow: `0 0 8px ${item.color}`,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              fontWeight: 600,
              color: item.color,
              letterSpacing: "0.03em",
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
