"use client";
import { QuestionPanel } from "./questionPanel";
import { CodeEditor } from "./codeEditor";
import { Question } from "@/modules/question/question.types";
import Link from "next/link";

interface CodingInterfaceProps {
  sessionId: number;
  question: Question;
}

export function CodingInterface(params: CodingInterfaceProps) {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <h1 className="font-mono text-lg font-semibold text-foreground hover:underline">
              PeerPrep
            </h1>
          </Link>
          <h3>{"sessionId" + params.sessionId}</h3>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Question */}
        <QuestionPanel question={params.question} />

        {/* Right Panel - Code Editor */}
        <CodeEditor sessionId={params.sessionId} />
      </div>
    </div>
  );
}
