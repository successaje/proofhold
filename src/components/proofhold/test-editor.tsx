"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import type { AcceptanceTest, Check, Predicate } from "@/lib/domain/test";
import styles from "./test-editor.module.css";

const checkKinds: {
  value: Check["kind"];
  label: string;
  evidence: Predicate["evidence"];
}[] = [
  { value: "count", label: "File count", evidence: "file" },
  { value: "mime", label: "File type", evidence: "file" },
  { value: "dimensions", label: "Image size", evidence: "file" },
  { value: "dpi", label: "Image resolution", evidence: "file" },
  { value: "deadline", label: "Delivered before", evidence: "file" },
  { value: "filename", label: "File name pattern", evidence: "file" },
  { value: "size", label: "File size", evidence: "file" },
  { value: "tracking_shipped", label: "Tracking number recorded", evidence: "tracking" },
  { value: "buyer_confirms", label: "Buyer confirms", evidence: "buyer_confirmation" },
  { value: "judgement", label: "Examiner judgement", evidence: "judgement" },
];

const mimeOptions = [
  ["image/png", "PNG"],
  ["image/jpeg", "JPEG"],
  ["image/svg+xml", "SVG"],
  ["image/webp", "WebP"],
  ["application/pdf", "PDF"],
  ["text/markdown", "Markdown"],
  ["text/plain", "Text"],
  ["application/zip", "ZIP"],
] as const;

function defaultCheck(kind: Check["kind"]): Check {
  switch (kind) {
    case "count":
      return { kind, min: 1 };
    case "mime":
      return { kind, allowed: ["image/png"] };
    case "dimensions":
      return { kind, min_width: 1000 };
    case "dpi":
      return { kind, min: 300 };
    case "deadline":
      return { kind, before: new Date(Date.now() + 7 * 86_400_000).toISOString() };
    case "filename":
      return { kind, pattern: "\\.(png|svg)$" };
    case "size":
      return { kind, max_bytes: 5 * 1024 * 1024 };
    case "tracking_shipped":
      return { kind };
    case "buyer_confirms":
      return { kind, prompt: "Did you receive what was agreed?" };
    case "judgement":
      return { kind, criteria: "" };
  }
}

function CheckParams({
  check,
  onChange,
}: {
  check: Check;
  onChange: (c: Check) => void;
}) {
  const num = (v: string) => (v === "" ? undefined : Number(v));
  switch (check.kind) {
    case "count":
      return (
        <div className={styles.params}>
          <Field label="At least" htmlFor={undefined}>
            <Input
              type="number"
              min={1}
              value={check.min}
              onChange={(e) => onChange({ ...check, min: Number(e.target.value) || 1 })}
            />
          </Field>
          <Field label="At most" optional>
            <Input
              type="number"
              min={1}
              value={check.max ?? ""}
              onChange={(e) => onChange({ ...check, max: num(e.target.value) })}
            />
          </Field>
          <Field label="Of type" optional hint="Leave empty for any type.">
            <div className={styles.chips}>
              {mimeOptions.map(([m, label]) => {
                const on = check.mime?.includes(m) ?? false;
                return (
                  <button
                    key={m}
                    type="button"
                    className={[styles.chip, on && styles.chipOn]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={on}
                    onClick={() => {
                      const next = on
                        ? (check.mime ?? []).filter((x) => x !== m)
                        : [...(check.mime ?? []), m];
                      onChange({ ...check, mime: next.length ? next : undefined });
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      );
    case "mime":
      return (
        <div className={styles.params}>
          <Field label="Allowed types">
            <div className={styles.chips}>
              {mimeOptions.map(([m, label]) => {
                const on = check.allowed.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    className={[styles.chip, on && styles.chipOn]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={on}
                    onClick={() => {
                      const next = on
                        ? check.allowed.filter((x) => x !== m)
                        : [...check.allowed, m];
                      if (next.length) onChange({ ...check, allowed: next });
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      );
    case "dimensions":
      return (
        <div className={styles.params}>
          <Field label="Min width (px)" optional>
            <Input
              type="number"
              min={1}
              value={check.min_width ?? ""}
              onChange={(e) => onChange({ ...check, min_width: num(e.target.value) })}
            />
          </Field>
          <Field label="Min height (px)" optional>
            <Input
              type="number"
              min={1}
              value={check.min_height ?? ""}
              onChange={(e) => onChange({ ...check, min_height: num(e.target.value) })}
            />
          </Field>
          <Field label="Exact width" optional>
            <Input
              type="number"
              min={1}
              value={check.exact_width ?? ""}
              onChange={(e) => onChange({ ...check, exact_width: num(e.target.value) })}
            />
          </Field>
          <Field label="Exact height" optional>
            <Input
              type="number"
              min={1}
              value={check.exact_height ?? ""}
              onChange={(e) => onChange({ ...check, exact_height: num(e.target.value) })}
            />
          </Field>
        </div>
      );
    case "dpi":
      return (
        <div className={styles.params}>
          <Field label="Minimum dpi">
            <Input
              type="number"
              min={1}
              value={check.min}
              onChange={(e) => onChange({ ...check, min: Number(e.target.value) || 72 })}
            />
          </Field>
        </div>
      );
    case "deadline":
      return (
        <div className={styles.params}>
          <Field label="Before (UTC)">
            <Input
              type="datetime-local"
              value={check.before.slice(0, 16)}
              onChange={(e) => {
                const d = new Date(e.target.value + "Z");
                if (!Number.isNaN(d.getTime()))
                  onChange({ ...check, before: d.toISOString() });
              }}
            />
          </Field>
        </div>
      );
    case "filename":
      return (
        <div className={styles.params}>
          <Field
            label="Regular expression"
            hint="Case-insensitive, matched against each file name."
          >
            <Input
              value={check.pattern}
              onChange={(e) => onChange({ ...check, pattern: e.target.value })}
            />
          </Field>
        </div>
      );
    case "size":
      return (
        <div className={styles.params}>
          <Field label="Max size (MB)" optional>
            <Input
              type="number"
              min={0.1}
              step={0.1}
              value={check.max_bytes ? check.max_bytes / 1048576 : ""}
              onChange={(e) =>
                onChange({
                  ...check,
                  max_bytes: e.target.value
                    ? Math.round(Number(e.target.value) * 1048576)
                    : undefined,
                })
              }
            />
          </Field>
          <Field label="Min size (KB)" optional>
            <Input
              type="number"
              min={1}
              value={check.min_bytes ? Math.round(check.min_bytes / 1024) : ""}
              onChange={(e) =>
                onChange({
                  ...check,
                  min_bytes: e.target.value
                    ? Math.round(Number(e.target.value) * 1024)
                    : undefined,
                })
              }
            />
          </Field>
        </div>
      );
    case "buyer_confirms":
      return (
        <div className={styles.params}>
          <Field label="Question the buyer answers">
            <Input
              value={check.prompt}
              onChange={(e) => onChange({ ...check, prompt: e.target.value })}
            />
          </Field>
        </div>
      );
    case "judgement":
      return (
        <div className={styles.params}>
          <Field
            label="Criteria the examiner applies"
            hint="Write it so a careful reviewer could apply it the same way twice."
          >
            <Input
              value={check.criteria}
              onChange={(e) => onChange({ ...check, criteria: e.target.value })}
            />
          </Field>
        </div>
      );
    case "tracking_shipped":
      return (
        <p className={styles.paramNote}>
          Passes when the seller records a carrier and tracking number in a valid format.
        </p>
      );
  }
}

export function TestEditor({
  test,
  onChange,
  disabled,
}: {
  test: AcceptanceTest;
  onChange: (t: AcceptanceTest) => void;
  disabled?: boolean;
}) {
  const update = (patch: Partial<AcceptanceTest>) => onChange({ ...test, ...patch });
  const updatePredicate = (i: number, patch: Partial<Predicate>) =>
    update({
      predicates: test.predicates.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    });
  const remove = (i: number) =>
    update({
      predicates: test.predicates
        .filter((_, j) => j !== i)
        .map((p, j) => ({ ...p, id: `p${j + 1}` })),
      rules: { ...test.rules, partial_release: [] },
    });
  const add = () =>
    update({
      predicates: [
        ...test.predicates,
        {
          id: `p${test.predicates.length + 1}`,
          text: "",
          evidence: "file",
          must_pass: true,
          check: defaultCheck("count"),
        },
      ],
    });
  const rule = test.rules.partial_release[0];

  return (
    <fieldset className={styles.editor} disabled={disabled}>
      <Field label="Summary" htmlFor="summary" hint="One line the buyer sees first.">
        <Input
          id="summary"
          value={test.summary}
          onChange={(e) => update({ summary: e.target.value })}
          maxLength={300}
        />
      </Field>

      <ol className={styles.predicates}>
        {test.predicates.map((p, i) => (
          <li key={p.id} className={styles.predicate}>
            <div className={styles.predicateHead}>
              <span className={styles.index}>{i + 1}</span>
              <Input
                aria-label={`Check ${i + 1} text`}
                value={p.text}
                placeholder="What must be true, in one sentence"
                onChange={(e) => updatePredicate(i, { text: e.target.value })}
                maxLength={240}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(i)}
                aria-label={`Remove check ${i + 1}`}
                icon={<Trash2 />}
              />
            </div>
            <div className={styles.predicateBody}>
              <Field label="Checked by">
                <Select
                  value={p.check.kind}
                  onChange={(e) => {
                    const kind = e.target.value as Check["kind"];
                    const evidence = checkKinds.find((k) => k.value === kind)!.evidence;
                    updatePredicate(i, { check: defaultCheck(kind), evidence });
                  }}
                >
                  {checkKinds.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <CheckParams
                check={p.check}
                onChange={(check) => updatePredicate(i, { check })}
              />
              <Checkbox
                checked={p.must_pass}
                onChange={(e) => updatePredicate(i, { must_pass: e.target.checked })}
                label={<>Must pass before any release</>}
              />
            </div>
          </li>
        ))}
      </ol>
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={add}
          icon={<Plus />}
          disabled={test.predicates.length >= 12}
        >
          Add a check
        </Button>
      </div>

      <div className={styles.rules}>
        <Field
          label="Buyer window (hours)"
          htmlFor="silence"
          hint="After checks pass, the buyer has this long to object before the hold releases."
        >
          <Input
            id="silence"
            type="number"
            min={1}
            max={336}
            value={test.rules.silence_window_hours}
            onChange={(e) =>
              update({
                rules: {
                  ...test.rules,
                  silence_window_hours: Math.min(
                    336,
                    Math.max(1, Number(e.target.value) || 1),
                  ),
                },
              })
            }
          />
        </Field>
        <Field
          label="Partial release"
          optional
          hint="If only these checks pass and the buyer stays silent, release this share and return the rest."
        >
          <div className={styles.rule}>
            <div className={styles.chips}>
              {test.predicates.map((p, i) => {
                const on = rule?.when_passed.includes(p.id) ?? false;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={[styles.chip, on && styles.chipOn]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={on}
                    onClick={() => {
                      const ids = on
                        ? (rule?.when_passed ?? []).filter((x) => x !== p.id)
                        : [...(rule?.when_passed ?? []), p.id];
                      update({
                        rules: {
                          ...test.rules,
                          partial_release: ids.length
                            ? [{ when_passed: ids, fraction: rule?.fraction ?? 0.5 }]
                            : [],
                        },
                      });
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className={styles.fraction}>
              <Input
                type="number"
                min={5}
                max={95}
                step={5}
                aria-label="Share released, percent"
                disabled={!rule}
                value={rule ? Math.round(rule.fraction * 100) : ""}
                onChange={(e) =>
                  rule &&
                  update({
                    rules: {
                      ...test.rules,
                      partial_release: [
                        {
                          ...rule,
                          fraction: Math.min(
                            0.95,
                            Math.max(0.05, Number(e.target.value) / 100),
                          ),
                        },
                      ],
                    },
                  })
                }
              />
              <span>%</span>
            </div>
          </div>
        </Field>
      </div>
    </fieldset>
  );
}
