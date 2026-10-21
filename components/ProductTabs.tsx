"use client";
import { useId, useState, type KeyboardEvent } from "react";

type Detail = { label: string; value: string };

type Block = { type: "p" | "ul"; lines: string[] };

// Lines starting with "-", "•" or "*" become a bullet list. Everything else is a paragraph.
function parseDescription(text: string): Block[] {
  const blocks: Block[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const bullet = /^[-•*]\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];

    if (bullet) {
      if (last?.type === "ul") last.lines.push(bullet[1]);
      else blocks.push({ type: "ul", lines: [bullet[1]] });
    } else {
      blocks.push({ type: "p", lines: [line] });
    }
  }

  return blocks;
}

const TABS = ["Description", "Details"] as const;

export default function ProductTabs({
  description,
  details,
}: {
  description: string;
  details: Detail[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Description");
  const uid = useId();
  const blocks = parseDescription(description);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setTab((t) => (t === "Description" ? "Details" : "Description"));
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Product information"
        onKeyDown={onKeyDown}
        className="flex gap-6 border-b border-gray-200"
      >
        {TABS.map((name) => {
          const selected = tab === name;
          return (
            <button
              key={name}
              type="button"
              role="tab"
              id={`${uid}-tab-${name}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel-${name}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(name)}
              className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition ${
                selected
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${uid}-panel-${tab}`}
        aria-labelledby={`${uid}-tab-${tab}`}
        className="pt-5"
      >
        {tab === "Description" &&
          (blocks.length === 0 ? (
            <p className="text-gray-500">No description yet.</p>
          ) : (
            <div className="max-w-3xl space-y-3 text-gray-700">
              {blocks.map((block, i) =>
                block.type === "ul" ? (
                  <ul key={i} className="list-disc space-y-1 pl-5">
                    {block.lines.map((line, j) => (
                      <li key={j}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={i}>{block.lines[0]}</p>
                )
              )}
            </div>
          ))}

        {tab === "Details" && (
          <dl className="max-w-xl divide-y divide-gray-100 overflow-hidden rounded-xl ring-1 ring-gray-200">
            {details.map((d) => (
              <div key={d.label} className="flex gap-4 px-4 py-3 text-sm even:bg-gray-50">
                <dt className="w-32 shrink-0 font-medium text-gray-500">{d.label}</dt>
                <dd className="min-w-0 text-gray-900">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}