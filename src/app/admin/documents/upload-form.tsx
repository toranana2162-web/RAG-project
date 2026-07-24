"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UploadForm() {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage({ ok: false, text: "PDFファイルを選択してください。" });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/documents", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: json?.error?.message ?? "アップロードに失敗しました。" });
        return;
      }
      setMessage({ ok: true, text: "アップロードしました（未処理）。" });
      form.reset();
      setFileName(null);
      startTransition(() => router.refresh());
    } catch {
      setMessage({ ok: false, text: "通信エラーが発生しました。" });
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || pending;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex-1 cursor-pointer">
          <input
            type="file"
            name="file"
            accept="application/pdf,.pdf"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-800"
          />
        </label>
        <Button type="submit" loading={busy}>
          {busy ? "アップロード中..." : "アップロード"}
        </Button>
      </div>
      {fileName && !message && (
        <p className="text-xs text-gray-500">選択中: {fileName}</p>
      )}
      {message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
