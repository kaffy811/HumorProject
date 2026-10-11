import type { CreateStep } from "@/stores/create-store";
export function StepPanel({
  number,
  title,
  summary,
  active,
  enabled,
  onOpen,
  children,
}: {
  number: CreateStep;
  title: string;
  summary: string;
  active: boolean;
  enabled: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`step-panel ${active ? "is-current" : ""}`}
      aria-labelledby={`step-title-${number}`}
    >
      <button
        className="step-summary"
        type="button"
        disabled={!enabled}
        onClick={onOpen}
        aria-expanded={active}
        aria-controls={`step-body-${number}`}
      >
        <span className="step-number" aria-hidden="true">
          {number}
        </span>
        <span id={`step-title-${number}`} className="step-title">
          {title}
        </span>
        {!active && summary && <span className="step-detail">{summary}</span>}
      </button>
      {active && (
        <div id={`step-body-${number}`} className="step-body">
          {children}
        </div>
      )}
    </section>
  );
}
