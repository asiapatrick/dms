"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, getToken } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) {
      router.replace("/documents");
      return;
    }
    login()
      .then(() => router.replace("/documents"))
      .catch(() => {
        // Login failed — stay on page, nothing to show
      });
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <span className="animate-spin">⏳</span>
        Signing in…
      </div>
    </div>
  );
}
