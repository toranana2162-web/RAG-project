import { Button } from "@/components/ui/button";

/**
 * サインアウトボタン。POST /auth/signout を叩く。
 */
export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="secondary" size="sm">
        ログアウト
      </Button>
    </form>
  );
}
