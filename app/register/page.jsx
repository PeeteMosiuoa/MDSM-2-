"use client";

import RegisterPage from "@/components/auth/register-page";
import { useRouter } from "next/navigation";
import { registerUser } from "@/app/actions/auth";

export default function Page() {
  const router = useRouter();

  const handleRegister = async (formData) => {
    try {
      const result = await registerUser(formData);

      console.log("Registration response:", result);

      if (!result || result.success === false) {
        alert(result?.error || "Registration failed");
        return;
      }

      alert("Registration successful! Please complete KYC verification.");

      router.push("/kyc/page");

    } catch (err) {
      console.error("Registration error:", err);
      alert("Something went wrong during registration");
    }
  };

  return <RegisterPage onSubmit={handleRegister} />;
}