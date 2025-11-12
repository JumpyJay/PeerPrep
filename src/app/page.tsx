"use client";

import Cookies from "js-cookie";
import { decodeJwtPayload } from "@/lib/decodeJWT";
import { useEffect, useMemo, useState } from "react";
import { MatchmakingTab } from "@/components/matchMakingTab";
import QuestionTab from "@/components/questionTab";
import { useRouter } from "next/navigation";
import { handleLogout } from "@/lib/logoutHelper";

export default function Home() {
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const myToken = Cookies.get("token");
    if (!myToken) return;
    const payload = decodeJwtPayload(myToken);
    const email = typeof payload?.id === "string" ? payload.id : "";
    if (email) {
      setUserEmail(email);
    }

    // fetch user profile to get username 
    fetch("/api/v1/user/profile", {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.username) {
          setUserName(data.username);
        }
      })
      .catch((err) => console.error(err));
  }, []);
  const [activeTab, setActiveTab] = useState<"matchmaking" | "problems">(
    "matchmaking"
  );
  const displayName = useMemo(() => {
    if (userName) { 
      // display username
      return userName;
    } else if (userEmail) { 
      // fallback
      const [name] = userEmail.split("@");
      return name || userEmail;
    }
    return "Guest";
  }, [userName, userEmail]);

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
                {/* Clickable avatar */}
                <div
                  onClick={() => router.push("/user/profile")}
                  className="h-10 w-10 rounded-full bg-black cursor-pointer hover:opacity-80 transition flex items-center justify-center text-white font-bold"
                  title="Go to your profile"
                >
                  {userEmail ? userEmail.charAt(0).toUpperCase() : "?"}
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
