"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function QuestionPanel() {
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
            value="solutions"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Solutions
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
                1. Two Sum
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Easy
                </span>
              </div>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p className="text-foreground">
                Given an array of integers{" "}
                <code className="rounded bg-code-bg px-1.5 py-0.5 font-mono text-accent">
                  nums
                </code>{" "}
                and an integer{" "}
                <code className="rounded bg-code-bg px-1.5 py-0.5 font-mono text-accent">
                  target
                </code>
                , return{" "}
                <em>
                  indices of the two numbers such that they add up to target
                </em>
                .
              </p>

              <p>
                You may assume that each input would have{" "}
                <strong>exactly one solution</strong>, and you may not use the
                same element twice.
              </p>

              <p>You can return the answer in any order.</p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold text-foreground">
                  Example 1:
                </h3>
                <div className="rounded-lg bg-code-bg p-4 font-mono text-sm">
                  <div className="text-muted-foreground">
                    <span className="text-foreground">Input:</span> nums =
                    [2,7,11,15], target = 9
                  </div>
                  <div className="text-muted-foreground">
                    <span className="text-foreground">Output:</span> [0,1]
                  </div>
                  <div className="text-muted-foreground">
                    <span className="text-foreground">Explanation:</span>{" "}
                    Because nums[0] + nums[1] == 9, we return [0, 1].
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-foreground">
                  Example 2:
                </h3>
                <div className="rounded-lg bg-code-bg p-4 font-mono text-sm">
                  <div className="text-muted-foreground">
                    <span className="text-foreground">Input:</span> nums =
                    [3,2,4], target = 6
                  </div>
                  <div className="text-muted-foreground">
                    <span className="text-foreground">Output:</span> [1,2]
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-foreground">
                  Example 3:
                </h3>
                <div className="rounded-lg bg-code-bg p-4 font-mono text-sm">
                  <div className="text-muted-foreground">
                    <span className="text-foreground">Input:</span> nums =
                    [3,3], target = 6
                  </div>
                  <div className="text-muted-foreground">
                    <span className="text-foreground">Output:</span> [0,1]
                  </div>
                </div>
              </div>
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
