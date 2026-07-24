/**
 * 管理者向け 文書API（個別）。
 * - DELETE: Storage実体 と documents行 を削除（chunksはcascadeで消える, D-4）。
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, toErrorResponse } from "@/lib/errors";

export const runtime = "nodejs";

const BUCKET = "documents";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const supabase = await createSupabaseServerClient();
    const { data: doc, error } = await supabase
      .from("documents")
      .select("id, storage_path")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new AppError("db_error", "文書の取得に失敗しました。", 500);
    }
    if (!doc) {
      throw new AppError("not_found", "文書が見つかりません。", 404);
    }

    // Storage実体を削除してから、DB行を削除（chunksはcascade）。
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    const { error: delError } = await supabase.from("documents").delete().eq("id", id);
    if (delError) {
      throw new AppError("db_error", "削除に失敗しました。", 500);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { status, body } = toErrorResponse(e);
    return NextResponse.json(body, { status });
  }
}
