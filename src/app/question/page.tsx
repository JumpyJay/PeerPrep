"use client";

import { useState } from "react";
import QuestionList from "./components/questionList";
import QuestionModal from "./components/questionModal";
import type { Question } from "@/modules/question/question.types";

export default function QuestionPage() {
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(
    null
  );

  return (
    <main className="min-h-screen bg-background">
      <QuestionList onSelectQuestion={setSelectedQuestion} />
      {selectedQuestion && (
        <QuestionModal
          question={selectedQuestion}
          onClose={() => setSelectedQuestion(null)}
        />
      )}
    </main>
  );
}
