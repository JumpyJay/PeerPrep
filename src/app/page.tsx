"use client";

import Cookies from "js-cookie";
import { decodeJwtPayload } from "@/lib/decodeJWT";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MatchmakingTab } from "@/components/matchMakingTab";
import QuestionTab from "@/components/questionTab";

export default function Home() {
  const [userEmail, setUserEmail] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const myToken = Cookies.get("token");

    if (myToken) {
      const payload = decodeJwtPayload(myToken);
      setUserEmail(payload.id);

      console.log("email: " + payload.id);
      console.log("expiration date: " + payload.exp);
    }
  }, []);

  const [activeTab, setActiveTab] = useState<"matchmaking" | "problems">(
    "matchmaking"
  );

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
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">
                {userEmail || "Not logged in"}
              </p>
              <p className="text-xs text-muted-foreground">Level 42</p>
            </div>

            {/* Clickable avatar */}
            <div
              onClick={() => router.push("/user/profile")}
              className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 cursor-pointer hover:opacity-80 transition flex items-center justify-center text-white font-bold"
              title="Go to your profile"
            >
              {userEmail ? userEmail.charAt(0).toUpperCase() : "?"}
            </div>
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
        {activeTab === "matchmaking" && <MatchmakingTab />}
        {activeTab === "problems" && <QuestionTab />}
      </div>
    </div>
  );
}
