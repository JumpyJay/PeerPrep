"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Question } from "@/modules/question/question.types";

interface QuestionCardProps {
  question: Question;
  onViewDetails: () => void;
}

const difficultyColors = {
  Easy: "bg-green-500/10 text-green-700 dark:text-green-400",
  Medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  Hard: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export default function QuestionCard({
  question,
  onViewDetails,
}: QuestionCardProps) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4 transition-all hover:shadow-lg">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="flex-1 text-lg font-semibold text-foreground">
          {question.question_title}
        </h3>
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

      <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
        {question.question_body}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {question.tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs">
            {tag}
          </Badge>
        ))}
      </div>

      <Button onClick={onViewDetails} className="mt-auto w-full">
        View Details
      </Button>
    </div>
  );
}
