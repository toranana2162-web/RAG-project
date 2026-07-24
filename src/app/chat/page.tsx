import { redirect } from "next/navigation";
import { getAllowedUser, isAdminUser } from "@/lib/auth/authorization";
import { AppHeader } from "@/components/app-header";
import { ChatForm } from "./chat-form";

/**
 * チャット画面。middleware に加えてページ側でも認証を確認する（多層防御・要件11）。
 */
export default async function ChatPage() {
  const user = await getAllowedUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader email={user.email ?? ""} isAdmin={isAdminUser(user)} active="chat" />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-6">
        <ChatForm />
      </main>
    </div>
  );
}
