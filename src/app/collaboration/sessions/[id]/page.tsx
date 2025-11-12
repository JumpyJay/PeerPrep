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
      // retrieve user token from cookie
      const rawToken = Cookies.get("token");
      if (rawToken) {
        const myToken = decodeJwtPayload(rawToken);
        // if user email does not match any of the session users
        // redirect to home page with a toast
        if (
          myToken &&
          myToken.id != session?.user1_email &&
          myToken.id != session?.user2_email
        ) {
          router.push("/");
          toast.error("You are not authorized to access this page.");
        } else if (session?.is_completed) {
          router.push("/");
          toast.error("Session has already been completed.");
        } else {
          // user is authorised, set user email state
          setUserEmail(String(myToken.id));
        }
      } else {
        // Handle case where there is no token
        toast.error("You are not logged in.");
        window.location.href = "/";
      }
    };

    const fetchQuestion = async () => {
      try {
        const questionResponse = await fetch(
          `/api/v1/question/${session?.question_id}`,
          {
            headers: { Authorization: "Bearer readerToken" },
          }
        );
        // await JSON from question API
        const question = await questionResponse.json();
        // set question state
        setQuestion(question);
      } catch (error) {
        console.error("Error fetching question:", error);
      }
    };

    // double check session is set
    if (session) {
      checkAuthenticated();
      fetchQuestion();
    }
    // this effect depends on session state
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
          <CodingInterface sessionId={sessionId} question={question} />
        )}
      </div>

      {/* Right column: Chat*/}
      {session && (
        <div className="w-[22rem] min-w-[18rem] max-w-[26rem] border-l border-border md:w-[24rem]">
          {(() => {
            const rawToken = Cookies.get("token");
            const payload = rawToken ? decodeJwtPayload(rawToken) : null;
            const me = (payload?.email || payload?.id || "me@example.com").toString();
            return <ChatPanel sessionId={sessionId} me={me} />;
          })()}
      </div>
    )}
  </div>
)};
