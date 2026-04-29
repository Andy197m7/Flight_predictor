"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Markets functionality has been combined with the main dashboard
// This page redirects to the main page for backwards compatibility
export default function MarketsRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/");
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <p className="text-[var(--fs-muted)]">Redirecting to Markets...</p>
        </div>
    );
}
