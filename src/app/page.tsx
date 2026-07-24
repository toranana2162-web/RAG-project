import { redirect } from "next/navigation";

/**
 * ルート。middleware が未認証を /login へ流す。認証済みは /chat を表示する。
 */
export default function Home() {
  redirect("/chat");
}
