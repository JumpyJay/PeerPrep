"use client";

import { useState } from "react";
import QuestionList from "@/app/question/components/questionList";
import QuestionModal from "@/app/question/components/questionModal";
import type { Question } from "@/modules/question/question.types";

export default function QuestionTab() {
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
