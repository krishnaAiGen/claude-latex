"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useEditorStore } from "@/store/editorStore";
import { getToken, getStoredUser } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setAuth } = useEditorStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Skip auth check on login page
    if (pathname === "/login") {
      setChecked(true);
      return;
    }

    const token = getToken();
    const storedUser = getStoredUser();

    if (token && storedUser && !user) {
      // Restore from localStorage
      setAuth(storedUser, token);
      setChecked(true);
    } else if (!token) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [pathname, user, setAuth, router]);

  if (!checked) return null;

  return <>{children}</>;
}
