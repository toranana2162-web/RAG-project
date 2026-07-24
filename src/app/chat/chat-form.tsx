"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface Citation {
  fileName: string;
  pageNumber: number;
}
interface ChatAnswer {
  answerable: boolean;
  answer: string;
  citations: Citation[];
}
interface Exchange {
  id: number;
  question: string;
  answer?: ChatAnswer;
  error?: string;
  loading: boolean;
}

export function ChatForm() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  async function ask(q: string) {
    const id = nextId.current++;
    setExchanges((prev) => [...prev, { id, question: q, loading: true }]);
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const json = await res.json();
      setExchanges((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                loading: false,
                ...(res.ok
                  ? { answer: json as ChatAnswer }
                  : { error: json?.error?.message ?? "回答の取得に失敗しました。" }),
              }
            : e,
        ),
      );
    } catch {
      setExchanges((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, loading: false, error: "通信エラーが発生しました。" } : e,
        ),
      );
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setQuestion("");
    void ask(q);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // IME（日本語）変換中のEnterは送信しない。変換確定のEnterと競合させないため。
    if (e.nativeEvent.isComposing || e.key === "Process" || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* 会話ログ */}
      <div className="flex-1 space-y-6">
        {exchanges.length === 0 && (
          <div className="mt-10 text-center text-sm text-gray-500">
            <p>社内文書について質問してください。</p>
            <p className="mt-1 text-xs text-gray-400">
              回答には根拠となるファイル名とページ番号が表示されます。
            </p>
          </div>
        )}

        {exchanges.map((e) => (
          <div key={e.id} className="space-y-2">
            {/* 質問 */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gray-900 px-4 py-2 text-sm text-white">
                {e.question}
              </div>
            </div>

            {/* 回答 */}
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
                {e.loading && (
                  <span className="flex items-center gap-2 text-gray-500">
                    <Spinner /> 回答を生成しています…
                  </span>
                )}
                {e.error && <span className="text-red-600">{e.error}</span>}
                {e.answer && (
                  <div className="flex flex-col gap-3">
                    <p
                      className={`whitespace-pre-wrap ${
                        e.answer.answerable ? "text-gray-800" : "text-gray-500"
                      }`}
                    >
                      {e.answer.answer}
                    </p>
                    {e.answer.answerable && e.answer.citations.length > 0 && (
                      <div className="border-t border-gray-100 pt-2">
                        <p className="text-xs font-semibold text-gray-500">出典</p>
                        <ul className="mt-1 space-y-0.5">
                          {e.answer.citations.map((c, i) => (
                            <li key={i} className="text-xs text-gray-600">
                              {c.fileName}／{c.pageNumber}ページ
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 入力欄 */}
      <form
        onSubmit={onSubmit}
        className="sticky bottom-4 flex items-end gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="質問を入力（Enterで送信 / Shift+Enterで改行）"
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
        />
        <Button type="submit" loading={loading} disabled={!question.trim()}>
          送信
        </Button>
      </form>
    </div>
  );
}
