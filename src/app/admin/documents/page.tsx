import { redirect } from "next/navigation";
import { getAllowedUser, isAdminUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { UploadForm } from "./upload-form";
import { DeleteButton, ProcessButton } from "./document-actions";

interface DocumentRow {
  id: string;
  file_name: string;
  status: string;
  page_count: number | null;
  chunk_count: number | null;
  error_message: string | null;
  byte_size: number;
  created_at: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate(),
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export default async function AdminDocumentsPage() {
  const user = await getAllowedUser();
  if (!user) redirect("/login");
  if (!isAdminUser(user)) redirect("/chat");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("documents")
    .select("id, file_name, status, page_count, chunk_count, error_message, byte_size, created_at")
    .order("created_at", { ascending: false });
  const documents = (data ?? []) as DocumentRow[];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader email={user.email ?? ""} isAdmin active="admin" />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-6">
        <section className="flex flex-col gap-2">
          <h1 className="text-lg font-bold text-gray-900">文書管理</h1>
          <Card className="p-4">
            <UploadForm />
            <p className="mt-2 text-xs text-gray-500">
              PDF形式・最大20MB。同じ内容のファイルは重複登録できません。アップロード後「処理」を押すと検索対象になります。
            </p>
          </Card>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-700">
            登録済み文書（{documents.length}件）
          </h2>

          {documents.length === 0 ? (
            <Card className="p-8 text-center text-sm text-gray-500">
              まだ文書がありません。上のフォームからPDFを登録してください。
            </Card>
          ) : (
            <Card className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={doc.status} />
                      <p className="truncate text-sm font-medium text-gray-900">
                        {doc.file_name}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatSize(doc.byte_size)}
                      {doc.page_count != null && ` ・ ${doc.page_count}ページ`}
                      {doc.chunk_count != null && ` ・ ${doc.chunk_count}チャンク`}
                      {` ・ ${formatDate(doc.created_at)}`}
                    </p>
                    {doc.error_message && (
                      <p className="mt-1 text-xs text-red-600">エラー: {doc.error_message}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ProcessButton id={doc.id} status={doc.status} />
                    <DeleteButton id={doc.id} fileName={doc.file_name} />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
