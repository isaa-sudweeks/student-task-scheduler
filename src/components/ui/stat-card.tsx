import React from "react";

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

export function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-white p-4 shadow dark:bg-neutral-800">
      {icon}
      <div className="flex flex-col">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">{label}</span>
        <span className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{value}</span>
      </div>
    </div>
  );
}

export default StatCard;

