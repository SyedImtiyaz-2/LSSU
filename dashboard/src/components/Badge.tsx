import clsx from "clsx";

type Variant = "green" | "red" | "yellow" | "blue" | "gray";

const styles: Record<Variant, string> = {
  green:  "bg-emerald-100 text-emerald-800",
  red:    "bg-rose-100 text-rose-800",
  yellow: "bg-amber-100 text-amber-800",
  blue:   "bg-blue-100 text-blue-800",
  gray:   "bg-gray-100 text-gray-600",
};

export default function Badge({ label, variant = "gray" }: { label: string; variant?: Variant }) {
  return (
    <span className={clsx("inline-block text-xs font-medium px-2 py-0.5 rounded-full", styles[variant])}>
      {label}
    </span>
  );
}
