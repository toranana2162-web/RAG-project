"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { sendMagicLink, type LoginActionState } from "./actions";

const initialState: LoginActionState = { ok: false, message: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-gray-700">社内メールアドレス</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.co.jp"
          className="rounded-md border border-gray-300 px-3 py-2 text-base outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
        />
      </label>

      <Button type="submit" loading={pending} className="w-full">
        {pending ? "送信中..." : "ログインリンクを送信"}
      </Button>

      {state.message && (
        <p
          role="status"
          className={`rounded-md px-3 py-2 text-sm ${
            state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
