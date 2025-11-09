"use client";

import { useEffect, useMemo, useState } from "react";
import { CodingInterface } from "../../components/codingInterface";
import { useParams, useRouter } from "next/navigation";
import { Session } from "@/modules/collaboration/session.types";
import { Question } from "@/modules/question/question.types";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { decodeJwtPayload } from "@/lib/decodeJWT";

export default function CollaborationPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = useMemo(() => {
    const raw = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params.id]);
  const [session, setSession] = useState<Session>();
  const [question, setQuestion] = useState<Question>();

  useEffect(() => {
    if (sessionId === null) {
      router.push("/");
    }
  }, [sessionId, router]);

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

    if (sessionId !== null) {
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
        }
      } else {
        // Handle case where there is no token
        toast.error("You are not logged in.");
        window.location.href = "/";
      }
    };

    const fetchQuestion = async () => {
      if (!session?.question_id) {
        return;
      }
      try {
        const questionResponse = await fetch(
          `/api/v1/question/${session?.question_id}`
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

  return (
    <div>
      {question && session && sessionId !== null && (
        <CodingInterface sessionId={sessionId} question={question} />
      )}
    </div>
  );
}
