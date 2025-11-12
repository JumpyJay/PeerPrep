// /src/app/collaboration/session/[id]/page.tsx

"use client";

import { useEffect, useState } from "react";
import { CodingInterface } from "../../components/codingInterface";
import { useParams, useRouter } from "next/navigation";
import { Session, Submission } from "@/modules/collaboration/session.types";
import { Question } from "@/modules/question/question.types";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { decodeJwtPayload } from "@/lib/decodeJWT";
import { ChatPanel } from "./ChatPanel";

export default function CollaborationPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Number(params.id);
  const [userEmail, setUserEmail] = useState<string>("");
  const [session, setSession] = useState<Session>();
  const [question, setQuestion] = useState<Question>();
  const [attempts, setAttempts] = useState<Submission[]>([]);

  useEffect(() => {
    // define async function to fetch and set session and question
    // input: session id from url params
    const fetchSession = async () => {
      try {
        const sessionResponse = await fetch(
          "/api/v1/collaboration?type=findsession",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
          }
        );
        // await JSON from collab API
        const sessionData = await sessionResponse.json();
        // set session state
        setSession(sessionData);
      } catch (error) {
        console.error("Error fetching session:", error); // Changed log message
      }
    };

    if (sessionId) {
      // Added a check to prevent running with NaN
      fetchSession();
    }
  }, [sessionId]);

  useEffect(() => {
  const checkAuthenticated = () => {
    const rawToken = Cookies.get("token");
    if (!rawToken) {
      toast.error("You are not logged in.");
      router.push("/");
      return;
    }

    const my = decodeJwtPayload(rawToken);     // JwtPayload | null
    if (!my) {
      toast.error("Invalid or expired login.");
      router.push("/");
      return;
    }

    // Prefer email, fall back to id
    const email = String(my.email ?? my.id ?? "");
    if (!email) {
      toast.error("Missing user identity.");
      router.push("/");
      return;
    }

    if (session?.is_completed) {
      toast.error("Session has already been completed.");
      router.push("/");
      return;
    }

    const notParticipant =
      email !== session?.user1_email && email !== session?.user2_email;

    if (notParticipant) {
      toast.error("You are not authorized to access this page.");
      router.push("/");
      return;
    }

    setUserEmail(email);
  };

  const fetchQuestion = async () => {
    if (!session?.question_id) return;
    try {
      const questionResponse = await fetch(
        `/api/v1/question/${session.question_id}`,
        { headers: { Authorization: "Bearer readerToken" } }
      );
      const q = await questionResponse.json();
      setQuestion(q);
    } catch (error) {
      console.error("Error fetching question:", error);
    }
  };

  if (session) {
    checkAuthenticated();
    fetchQuestion();
  }
}, [session, router]);


  useEffect(() => {
    // define a function to fetch attempt history
    const fetchAttempts = async () => {
      if (!userEmail || !session?.question_id) {
        return;
      }

      try {
        const attemptResponse = await fetch(
          "/api/v1/collaboration?type=findattempt",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              question_id: session.question_id,
              user_email: userEmail,
            }),
          }
        );
        const attempts: Submission[] = await attemptResponse.json();
        setAttempts(attempts);
      } catch (error) {
        console.log("Error fetching attempt history: ", error);
      }
    };

    fetchAttempts();
  }, [userEmail, session]);

  return (
    <div className="h-screen flex">
      {/* coding UI */}
      <div className="flex-1 min-w-0">
        {question && session && (
          <CodingInterface sessionId={sessionId} question={question} attempts={attempts}/>
        )}
      </div>

      {/* Right column: Chat*/}
      {session && (
        <div className="w-[22rem] min-w-[18rem] max-w-[26rem] border-l border-border md:w-[24rem]">
          <ChatPanel sessionId={sessionId} me={userEmail || "me@example.com"} />
      </div>
    )}
  </div>
)};