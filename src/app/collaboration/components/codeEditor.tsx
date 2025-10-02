"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const defaultCode = `function twoSum(nums: number[], target: number): number[] {
    // Write your solution here
    
};`;

export function CodeEditor() {
  const [code, setCode] = useState(defaultCode);
  const [language, setLanguage] = useState("typescript");

  return (
    <div className="flex w-1/2 flex-col">
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-md bg-secondary px-3 py-1.5 text-sm text-foreground outline-none hover:bg-secondary/80"
        >
          <option value="typescript">TypeScript</option>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>

        <div className="flex items-center gap-2">
          <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
            Reset
          </button>
        </div>
      </div>

      {/* Code Editor Area */}
      <div className="flex-1 overflow-y-auto bg-code-bg">
        <div className="flex h-full font-mono text-sm">
          {/* Line Numbers */}
          <div className="select-none border-r border-border bg-background px-4 py-4 text-right text-line-number">
            {code.split("\n").map((_, i) => (
              <div key={i} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code Area */}
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 resize-none bg-code-bg px-4 py-4 leading-6 text-foreground outline-none"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Bottom Panel - Test Cases */}
      <div className="border-t border-border">
        <Tabs defaultValue="testcase" className="flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4">
            <TabsTrigger
              value="testcase"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Testcase
            </TabsTrigger>
            <TabsTrigger
              value="result"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Test Result
            </TabsTrigger>
          </TabsList>

          <TabsContent value="testcase" className="h-40 overflow-y-auto p-4">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  nums =
                </label>
                <input
                  type="text"
                  defaultValue="[2,7,11,15]"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  target =
                </label>
                <input
                  type="text"
                  defaultValue="9"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="result" className="h-40 overflow-y-auto p-4">
            <p className="text-sm text-muted-foreground">
              Run your code to see results...
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
        <Button variant="outline" className="text-foreground bg-transparent">
          Run
        </Button>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          Submit
        </Button>
      </div>
    </div>
  );
}
