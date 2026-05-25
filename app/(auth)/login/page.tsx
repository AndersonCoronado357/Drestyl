import { AuthForm } from "@/components/auth/auth-form";
import { UrlErrorBanner } from "@/components/auth/url-error-banner";

export default function LoginPage() {
  return (
    <>
      <UrlErrorBanner />
      <AuthForm mode="login" />
    </>
  );
}
