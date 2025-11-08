"use client";

import { useEffect, useState } from "react";
import { CodingInterface } from "../../components/codingInterface";
import { useParams } from "next/navigation";
import { Session } from "@/modules/collaboration/session.types";
import { Question } from "@/modules/question/question.types";

export default function CollaborationPage() {
  const params = useParams();
  const sessionId = Number(params.id);
  const [session, setSession] = useState<Session>();
  const [question, setQuestion] = useState<Question>();

  useEffect(() => {
    // define async function to fetch and set session and question
    // input: session id from url params
    const fetchSessionAndQuestion = async () => {
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
        const question_id = sessionData.question_id;
        // fetch question from question API
        const questionResponse = await fetch(`/api/v1/question/${question_id}`);
        // await JSON from question API
        const question = await questionResponse.json();
        console.log("data: ", question);
        // set question state
        setQuestion(question);
      } catch (error) {
        console.error("Error fetching question:", error);
      }
    };

    fetchSessionAndQuestion();
  }, [sessionId]);

  return (
    <div>
      {question && session && (
        <CodingInterface sessionId={sessionId} question={question} />
      )}
    </div>
  );
}
