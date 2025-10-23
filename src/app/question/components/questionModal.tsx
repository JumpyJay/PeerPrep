"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { Question } from "@/modules/question/question.types";

interface QuestionModalProps {
  question: Question;
  onClose: () => void;
}

const difficultyColors = {
  Easy: "bg-green-500/10 text-green-700 dark:text-green-400",
  Medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  Hard: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export default function QuestionModal({
  question,
  onClose,
}: QuestionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-card">
        {/* Header */}
        <div className="sticky top-0 flex items-start justify-between border-b border-border bg-card p-6">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">
                {question.question_title}
              </h2>
              <Badge
                className={
                  difficultyColors[
                    question.difficulty as keyof typeof difficultyColors
                  ]
                }
              >
                {question.difficulty}
              </Badge>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-6 w-6 text-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Question Body */}
          <section className="mb-8">
            <h3 className="mb-3 text-lg font-semibold text-foreground">
              Description
            </h3>
            <p className="text-muted-foreground">{question.question_body}</p>
          </section>

          {/* Tags */}
          <section className="mb-8">
            <h3 className="mb-3 text-lg font-semibold text-foreground">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {question.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </section>

          {/* Solutions */}
          <section>
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Solutions
            </h3>

            {/* Solution Tabs */}
            <div className="mb-4 flex gap-2 border-b border-border">
              <pre className="overflow-x-auto text-sm text-foreground">
                <code>{question.code_solution}</code>
              </pre>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-card p-6">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
