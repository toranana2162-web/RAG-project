import { Card } from "@/components/ui/card";
import { LoginForm } from "./login-form";

const ERROR_MESSAGES: Record<string, string> = {
  domain: "このアカウントは利用できません。許可された社内ドメインのみログインできます。",
  auth: "ログインに失敗しました。お手数ですが、もう一度お試しください。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">社内文書検索AI</h1>
        <p className="mt-2 text-sm text-gray-600">
          社内メールアドレスでログインしてください。
          <br />
          メールに届くリンクからログインできます。
        </p>
      </div>

      {errorMessage && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      )}

      <Card className="p-6">
        <LoginForm />
      </Card>

      <p className="text-center text-xs text-gray-400">
        許可された社内ドメインのアカウントのみご利用いただけます。
      </p>
    </main>
  );
}
