"use client";

import Cookies from "js-cookie";
import { decodeJwtPayload } from "@/lib/decodeJWT";
import { useEffect, useMemo, useState, useCallback } from "react";
import { MatchmakingTab } from "@/components/matchMakingTab";
import QuestionTab from "@/components/questionTab";
import { useRouter } from "next/navigation";

export default function Home() {
  const [userEmail, setUserEmail] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const myToken = Cookies.get("token");
    if (!myToken) return;
    const payload = decodeJwtPayload(myToken);
    const email = typeof payload?.id === "string" ? payload.id : "";
    if (email) {
      setUserEmail(email);
    }
  }, []);
  const [activeTab, setActiveTab] = useState<"matchmaking" | "problems">(
    "matchmaking"
  );
  const handleLogout = useCallback(() => {
    Cookies.remove("token");
    window.location.href = "/user";
  }, []);
  const displayName = useMemo(() => {
    if (userEmail) {
      const [name] = userEmail.split("@");
      return name || userEmail;
    }
    return "Guest";
  }, [userEmail]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">PeerPrep</h1>
            <p className="text-sm text-muted-foreground">
              Collaborative Problem Solving
            </p>
          </div>
          <div className="flex items-center gap-4">
            {userEmail ? (
              <>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{userEmail}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push("/user")}
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-6 flex gap-1">
          <button
            onClick={() => setActiveTab("matchmaking")}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === "matchmaking"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            🎯 Find Partner
          </button>
          <button
            onClick={() => setActiveTab("problems")}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === "problems"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            📚 All Problems
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {activeTab === "matchmaking" && <MatchmakingTab userId={userEmail} />}
        {activeTab === "problems" && <QuestionTab />}
      </div>
    </div>
  );
}
