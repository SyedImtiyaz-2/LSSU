"use client";
import { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface Props {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  color?: "navy" | "gold" | "green" | "red";
}

const colorMap = {
  navy:  "bg-[#003F6B] text-white",
  gold:  "bg-[#C8992A] text-white",
  green: "bg-emerald-600 text-white",
  red:   "bg-rose-600 text-white",
};

export default function StatsCard({ title, value, sub, icon: Icon, color = "navy" }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
      <div className={clsx("p-3 rounded-lg shrink-0", colorMap[color])}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
