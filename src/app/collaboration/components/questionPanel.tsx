"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Question } from "@/modules/question/question.types";

interface questionPanelProps {
  question: Question;
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

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Constraints:</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>
                  <code className="rounded bg-code-bg px-1.5 py-0.5 font-mono text-accent">
                    2 &lt;= nums.length &lt;= 10⁴
                  </code>
                </li>
                <li>
                  <code className="rounded bg-code-bg px-1.5 py-0.5 font-mono text-accent">
                    -10⁹ &lt;= nums[i] &lt;= 10⁹
                  </code>
                </li>
                <li>
                  <code className="rounded bg-code-bg px-1.5 py-0.5 font-mono text-accent">
                    -10⁹ &lt;= target &lt;= 10⁹
                  </code>
                </li>
                <li>
                  <strong>Only one valid answer exists.</strong>
                </li>
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="editorial" className="flex-1 overflow-y-auto p-6">
          <p className="text-muted-foreground">
            Editorial content coming soon...
          </p>
        </TabsContent>

        <TabsContent value="solutions" className="flex-1 overflow-y-auto p-6">
          <p className="text-muted-foreground">
            Solutions content coming soon...
          </p>
        </TabsContent>

        <TabsContent value="submissions" className="flex-1 overflow-y-auto p-6">
          <p className="text-muted-foreground">No submissions yet...</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
