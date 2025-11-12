"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Submission } from "@/modules/collaboration/session.types";
import { Question } from "@/modules/question/question.types";
import { Users } from "lucide-react"; // Added
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"; // Added
import { Button } from "@/components/ui/button"; // Added
import SubmissionDetailsView from "@/app/collaboration/components/submissionDetailView"; // Added

interface questionPanelProps {
  question: Question;
  attempts: Submission[];
}

export function QuestionPanel(params: questionPanelProps) {
  return (
    <div className="flex w-1/2 flex-col border-r border-border">
      <Tabs defaultValue="description" className="flex flex-1 flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4">
          <TabsTrigger
            value="description"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Description
          </TabsTrigger>
          <TabsTrigger
            value="submissions"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Submissions
          </TabsTrigger>
        </TabsList>

        {/* --- DESCRIPTION TAB --- */}
        <TabsContent value="description" className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">
                {params.question.question_title}
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {params.question.difficulty}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {params.question.tags.map((tag, index) => (
                  <span
                    key={tag}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium text-white`}
                    style={{
                      backgroundColor: `hsl(${30 + index * 10}, 80%, 50%)`,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p className="text-foreground">{params.question.question_body}</p>
            </div>
          </div>
        </TabsContent>

        {/* --- SUBMISSIONS TAB (Updated) --- */}
        <TabsContent value="submissions" className="flex-1 overflow-y-auto p-6">
          {params.attempts.length === 0 ? (
            <p className="text-muted-foreground">No submissions yet...</p>
          ) : (
            <div className="space-y-4">
              {[...params.attempts]
                // Sort by most recent
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                )
                .map((submission) => (
                  <div
                    key={submission.submission_id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      {/* Submission Date */}
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Submission
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(submission.created_at).toLocaleString()}
                        </p>
                      </div>
                      {/* Partner Info */}
                      <div className="mt-2 flex items-center space-x-2 sm:mt-0">
                        <span className="truncate text-xs text-muted-foreground">
                          {submission.user1_email}
                        </span>
                        <Users
                          className="h-4 w-4 flex-shrink-0 text-muted-foreground"
                          aria-label="with"
                        />
                        <span className="truncate text-xs text-muted-foreground">
                          {submission.user2_email}
                        </span>
                      </div>
                    </div>
                    {/* View Solution Button */}
                    <div className="mt-4 flex justify-end">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="secondary" size="sm">
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="min-w-3xl max-w-5xl">
                          <SubmissionDetailsView submission={submission} />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
