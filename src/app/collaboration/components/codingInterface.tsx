"use client";
import { QuestionPanel } from "./questionPanel";
import { CodeEditor } from "./codeEditor";

export function CodingInterface() {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-4">
          <h1 className="font-mono text-lg font-semibold text-foreground">
            PeerPrep
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
            Premium
          </button>
          <button className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Sign In
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Question */}
        <QuestionPanel />

        {/* Right Panel - Code Editor */}
        <CodeEditor />
      </div>
    </div>
  );
}
