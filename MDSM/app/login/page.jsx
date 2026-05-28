"use client";

import { useRouter } from "next/navigation";
import LoginPage from "@/components/auth/login-page"; // adjust path if needed

export default function Page() {
  const router = useRouter();

  return (
    <LoginPage
      onBack={() => router.push("/")}
      onRegister={() => router.push("/register")}
    />
  );
}