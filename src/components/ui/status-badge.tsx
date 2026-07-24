const STATUS: Record<string, { label: string; className: string }> = {
  uploaded: { label: "未処理", className: "bg-gray-100 text-gray-700" },
  processing: { label: "処理中", className: "bg-blue-100 text-blue-700" },
  completed: { label: "完了", className: "bg-green-100 text-green-700" },
  failed: { label: "失敗", className: "bg-red-100 text-red-700" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}
    >
      {s.label}
    </span>
  );
}
