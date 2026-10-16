"use client";
import { useMemo } from "react";
import {
  DEFAULT_ROW,
  MAX_COMBINATIONS,
  MAX_OPTIONS,
  buildCombos,
  parseValues,
  type OptionDraft,
  type RowDraft,
  type VariantsDraft,
} from "@/lib/variantDraft";

type Props = {
  draft: VariantsDraft;
  onChange: (draft: VariantsDraft) => void;
};

const PRESETS: OptionDraft[] = [
  { name: "RAM", valuesText: "8GB, 16GB" },
  { name: "Storage", valuesText: "256GB, 512GB" },
  { name: "Color", valuesText: "Black, Silver" },
];

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

export default function VariantEditor({ draft, onChange }: Props) {
  const combos = useMemo(() => buildCombos(draft.options), [draft.options]);

  const setOption = (index: number, patch: Partial<OptionDraft>) =>
    onChange({
      ...draft,
      options: draft.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    });

  const addOption = (preset?: OptionDraft) =>
    onChange({ ...draft, options: [...draft.options, preset ?? { name: "", valuesText: "" }] });

  const removeOption = (index: number) =>
    onChange({ ...draft, options: draft.options.filter((_, i) => i !== index) });

  const setRow = (key: string, patch: Partial<RowDraft>) =>
    onChange({
      ...draft,
      rows: { ...draft.rows, [key]: { ...(draft.rows[key] ?? DEFAULT_ROW), ...patch } },
    });

  const usedNames = draft.options.map((o) => o.name.trim().toLowerCase());
  const availablePresets = PRESETS.filter((p) => !usedNames.includes(p.name.toLowerCase()));
  const canAdd = draft.options.length < MAX_OPTIONS;

  return (
    <section className="rounded-xl border border-gray-200 p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-gray-900">Options (optional)</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Add options like RAM or Storage when buyers can choose between versions. Each combination
        gets its own price and stock.
      </p>

      {draft.options.length > 0 && (
        <ul className="mt-4 space-y-3">
          {draft.options.map((option, index) => {
            const values = parseValues(option.valuesText);
            return (
              <li key={index} className="rounded-lg bg-gray-50 p-3">
                <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-[10rem_1fr]">
                  <div>
                    <label htmlFor={`option-name-${index}`} className={labelClass}>
                      Option name
                    </label>
                    <input
                      id={`option-name-${index}`}
                      type="text"
                      maxLength={30}
                      value={option.name}
                      onChange={(e) => setOption(index, { name: e.target.value })}
                      placeholder="e.g. RAM"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`option-values-${index}`} className={labelClass}>
                      Values (separate with commas)
                    </label>
                    <input
                      id={`option-values-${index}`}
                      type="text"
                      value={option.valuesText}
                      onChange={(e) => setOption(index, { valuesText: e.target.value })}
                      placeholder="e.g. 8GB, 16GB, 32GB"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {values.map((v) => (
                      <span
                        key={v}
                        className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 ring-1 ring-gray-200"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="shrink-0 text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove option
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canAdd && (
        <div className="mt-3 flex flex-wrap gap-2">
          {availablePresets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => addOption(preset)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              + {preset.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => addOption()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
          >
            + Custom option
          </button>
        </div>
      )}

      {combos.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-gray-900">
            Prices and stock ({combos.length} {combos.length === 1 ? "combination" : "combinations"})
          </h4>
          <p className="mt-0.5 text-xs text-gray-500">
            Untick &quot;Offered&quot; for combinations you don&apos;t sell.
          </p>

          {combos.length > MAX_COMBINATIONS && (
            <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              Too many combinations. The limit is {MAX_COMBINATIONS}. Remove some values.
            </p>
          )}

          <ul className="mt-3 space-y-2">
            {combos.map((combo) => {
              const row = draft.rows[combo.key] ?? DEFAULT_ROW;
              return (
                <li
                  key={combo.key}
                  className={`rounded-lg border p-3 ${
                    row.offered ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm font-medium ${
                        row.offered ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {combo.label}
                    </p>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={row.offered}
                        onChange={(e) => setRow(combo.key, { offered: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      Offered
                    </label>
                  </div>

                  {row.offered && (
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={`price-${combo.key}`} className={labelClass}>
                          Price
                        </label>
                        <input
                          id={`price-${combo.key}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={row.price}
                          onChange={(e) => setRow(combo.key, { price: e.target.value })}
                          placeholder="0.00"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label htmlFor={`stock-${combo.key}`} className={labelClass}>
                          Stock
                        </label>
                        <input
                          id={`stock-${combo.key}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={row.stock}
                          onChange={(e) => setRow(combo.key, { stock: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}