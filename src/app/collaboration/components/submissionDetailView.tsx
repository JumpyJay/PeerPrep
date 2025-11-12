"use client";

import { useEffect, useState } from "react";
import { Submission } from "@/modules/collaboration/session.types";
import { Loader2 } from "lucide-react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Question } from "@/modules/question/question.types";

export default function SubmissionDetailsView({
  submission,
}: {
  submission: Submission;
}) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestionInfo = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/question/${submission.question_id}`, {
          headers: { Authorization: "Bearer readerToken" },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch question details");
        }

        const data = await res.json();

        setQuestion(data);
      } catch (error) {
        console.log("error: ", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestionInfo();
  }, [submission.question_id]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Submission for Session {submission.session_id}
        </DialogTitle>
        <DialogDescription>
          Question ID: {submission.question_id}
          {question?.question_title ? ` - ${question.question_title}` : ""}
        </DialogDescription>
      </DialogHeader>

      {/* --- column layout --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 max-h-[70vh] min-h-[400px]">
        {/* left column */}
        <div className="flex flex-col space-y-4 pr-4 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <h3 className="text-lg font-semibold">Question Details</h3>
          {isLoading && (
            <div className="flex items-center space-x-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading question...</span>
            </div>
          )}
          {error && <div className="text-red-500">Error: {error}</div>}
          {question && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Title</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {question.question_title}
                </p>
              </div>{" "}
              <div>
                <h4 className="font-semibold">Category</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {question.tags.join(", ")}
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Description</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {question.question_body}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* right column */}
        <div className="flex flex-col space-y-4 overflow-y-auto">
          <h3 className="text-lg font-semibold">Submitted Solution</h3>
          <div className="bg-gray-900 dark:bg-gray-800 rounded-md p-4 flex-1">
            <pre className="text-sm text-gray-100 whitespace-pre-wrap">
              <code>{submission.users_solution}</code>
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}
