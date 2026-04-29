"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface HeaderProps {
    children?: ReactNode;
}

export function Header({ children }: HeaderProps) {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <header className="border-b border-white/5 bg-[var(--fs-primary)]/80 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--fs-accent)] to-[var(--fs-accent)]/50 flex items-center justify-center glow-accent">
                                <svg
                                    className="w-6 h-6 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight text-white">
                                    FlightSense
                                </h1>
                            </div>
                        </Link>

                        {/* Navigation */}
                        <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                            <Link
                                href="/"
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/") || isActive("/markets")
                                        ? "bg-[var(--fs-accent)] text-white shadow-lg shadow-[var(--fs-accent)]/20"
                                        : "text-[var(--fs-muted)] hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                Markets
                            </Link>
                            <Link
                                href="/portfolio"
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/portfolio")
                                        ? "bg-[var(--fs-accent)] text-white shadow-lg shadow-[var(--fs-accent)]/20"
                                        : "text-[var(--fs-muted)] hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                Portfolio
                            </Link>
                        </nav>
                    </div>

                    {/* Page Specific Actions */}
                    <div className="flex items-center gap-4">
                        {children}
                    </div>
                </div>
            </div>
        </header>
    );
}
