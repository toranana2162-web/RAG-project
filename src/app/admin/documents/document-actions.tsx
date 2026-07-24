"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ProcessButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "processing") {
    return <span className="text-xs text-blue-600">処理中...</span>;
  }

  const label = status === "completed" ? "再処理" : "処理";

  async function onProcess() {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/documents/${id}/process`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? "処理に失敗しました。");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setProcessing(false);
    }
  }

  const busy = processing || pending;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" onClick={onProcess} loading={busy}>
        {busy ? "実行中..." : label}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function DeleteButton({ id, fileName }: { id: string; fileName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!confirm(`「${fileName}」を削除しますか？（元に戻せません）`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? "削除に失敗しました。");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setDeleting(false);
    }
  }

  const busy = deleting || pending;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="danger" size="sm" onClick={onDelete} loading={busy}>
        {busy ? "削除中..." : "削除"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
