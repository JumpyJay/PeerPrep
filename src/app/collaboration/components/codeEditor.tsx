"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { io } from "socket.io-client";
import "quill/dist/quill.snow.css";
import type QuillType from "quill";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import * as monaco from "monaco-editor";

// dynamically import Monaco editor
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface CodeEditorProps {
  sessionId: number;
}

interface CodePayload {
  value: string;
}

const defaultCode = ``;

type TranslationStyle = "literal" | "idiomatic";

interface TranslationResult {
  translatedCode: string;
  provider: string;
  cached: boolean;
}

const languageOptions = [
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
];

export function CodeEditor({ sessionId }: CodeEditorProps) {
  const router = useRouter();
  const quillRef = useRef<QuillType | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const [connected, setConnected] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);

  const [language, setLanguage] = useState("typescript");
  const [targetLanguage, setTargetLanguage] = useState(
    languageOptions.find((option) => option.value !== "typescript")?.value ??
      languageOptions[0].value
  );
  const [translationStyle, setTranslationStyle] =
    useState<TranslationStyle>("idiomatic");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translation, setTranslation] = useState<TranslationResult | null>(
    null
  );

  const languageLabel = useMemo(() => {
    return (
      languageOptions.find((option) => option.value === language)?.label ??
      language
    );
  }, [language]);

  const targetLanguageLabel = useMemo(() => {
    return (
      languageOptions.find((option) => option.value === targetLanguage)
        ?.label ?? targetLanguage
    );
  }, [targetLanguage]);

  useEffect(() => {
    const s = io("http://localhost:3001");
    socketRef.current = s;

    const onConnect = () => {
      setConnected(true);
      s.emit("join-session", sessionId);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onReceiveCode = (payload: string | CodePayload ) => {
      if (!editorRef.current) return;
      const model = editorRef.current.getModel();
      if (!model) return;

      if (typeof payload === "string") {
        model.setValue(payload);
      } else if (payload.value) {
        model.setValue(payload.value);
      }
    };

    const onPartnerDisconnect = () => {
      // Show the toast
      toast.warning(
        "Partner disconnected, session will be terminated in 10 seconds."
      );
    };

    const onPartnerConnect = () => {
      toast.success("Partner connected!");
    };

    const onTerminateSession = async () => {
      console.log("[socket] Session terminated by server.");
      // call collaboration service to delete the session
      try {
        const response = await fetch(
          "/api/v1/collaboration?type=deletesession",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
          }
        );

        if (response.ok) {
          console.log("session deleted!");
        } else {
          console.error("Failed to delete session");
        }
      } catch (error) {
        console.error("Error deleting session:", error);
      }

      // Show the toast
      toast.error(
        "Session Terminated, You were the only one in the room for 10 seconds."
      );

      // Navigate to homepage
      router.push("/");
    };

    const onCompleteSession = () => {
      console.log("[socket] Session completed by server.");

      // Show the toast
      toast.success("Session Completed!!");

      // Navigate to homepage
      router.push("/");
    };

    const getFullCode = (requesterSocketId: string) => {
      if (!editorRef.current) return;
      const code = editorRef.current.getValue();
      s.emit("send-full-code", { code, targetSocketId: requesterSocketId });
    };

    const receiveFullCode = (fullCode: string) => {
      if (!editorRef.current) return;
      const model = editorRef.current.getModel();
      if (model) model.setValue(fullCode);
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("receive-code", onReceiveCode);
    s.on("terminate-session", onTerminateSession);
    s.on("partner-disconnect", onPartnerDisconnect);
    s.on("complete-session", onCompleteSession);
    s.on("partner-connect", onPartnerConnect);
    s.on("get-full-code", getFullCode);
    s.on("receive-full-code", receiveFullCode);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("receive-code", onReceiveCode);
      s.off("terminate-session", onTerminateSession);
      s.off("partner-disconnect", onPartnerDisconnect);
      s.off("complete-session", onCompleteSession);
      s.off("partner-connect", onPartnerConnect);
      s.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, router]);

  const handleEditorMount = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) => {
      editorRef.current = editor;
      monacoRef.current = monacoInstance;

      // initialize default content
      const model = editor.getModel();
      const initialValue = defaultCode.trim()
        ? defaultCode
        : "// Start solving…";
      if (model && !model.getValue()) model.setValue(initialValue);

      // detect user changes and send to socket
      editor.onDidChangeModelContent(() => {
        if (!socketRef.current || !connected) return;
        socketRef.current.emit("send-code", { value: editor.getValue() });
      });
    },
    [connected]
  );

  const getCurrentCode = useCallback(() => editorRef.current?.getValue() ?? "", []);

  const handleReset = useCallback(() => {
    editorRef.current?.setValue(defaultCode);
    setTranslation(null);
    setTranslationError(null);
  }, []);

  const handleReplaceEditor = () => {
    if (translation?.translatedCode && editorRef.current) {
      editorRef.current.setValue(translation.translatedCode);
    }
  };

  async function handleTranslate() {
    const currentCode = getCurrentCode().trim();
    if (!currentCode) {
      setTranslationError("Please provide some code to translate.");
      return;
    }
    if (language === targetLanguage) {
      setTranslationError("Choose a different target language.");
      return;
    }

    setTranslationError(null);
    setIsTranslating(true);
    try {
      const response = await fetch("/api/v1/question/translate/ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCode: currentCode,
          fromLang: languageLabel,
          toLang: targetLanguageLabel,
          style: translationStyle,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          payload?.error ?? "Translation failed. Please try again."
        );
      }

      const payload = (await response.json()) as TranslationResult;
      setTranslation(payload);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to translate right now.";
      setTranslationError(message);
      setTranslation(null);
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleCopyTranslation() {
    if (!translation?.translatedCode) return;
    try {
      await navigator.clipboard.writeText(translation.translatedCode);
    } catch {
      setTranslationError("Could not copy to clipboard. Please copy manually.");
    }
  }

  // define function for submit code
  const handleSubmitCode = () => {
    console.log("[socket] Submitting code.");
    if (!socketRef.current || !connected) return;
    const code = quillRef.current?.getText() ?? "";
    socketRef.current.emit("submit-code", String(sessionId), code);
  };

  // define function for handle end session
  const handleEndSession = () => {
    console.log("[socket] End session.");

    // navigate to homepage
    router.push("/");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-md bg-secondary px-3 py-1.5 text-sm text-foreground outline-none hover:bg-secondary/80"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button variant="ghost" onClick={handleReset}>
            Reset
          </Button>
          <span
            className={`text-xs ${
              connected ? "text-green-500" : "text-red-500"
            }`}
          >
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <Button onClick={() => handleEndSession()}>End Session</Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-code-bg">
        <div className="flex h-full font-mono text-sm">
          <div className="flex-1 p-0">
            <div className="flex-1 min-h-0 overflow-auto bg-code-bg">
              <MonacoEditor
                height="420px"
                defaultLanguage={language}
                language={language}
                defaultValue={defaultCode}
                theme="vs"
                onMount={handleEditorMount}
                options={{
                  minimap: { enabled: false },
                  fontFamily: "Fira Code, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                  fontSize: 13,
                  tabSize: 2,
                  smoothScrolling: true,
                  autoClosingBrackets: "always",
                  autoClosingQuotes: "always",
                  automaticLayout: true,
                  formatOnPaste: true,
                  formatOnType: true,
                  quickSuggestions: true,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-border
                bg-background/95 backdrop-blur
                supports-[backdrop-filter]:bg-background/60
                px-6 py-4">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    {/* Left: translation controls */}
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1 text-sm min-w-[180px]">
        <span className="text-xs text-muted-foreground">Translate to</span>
        <select
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          className="rounded-md bg-secondary px-3 py-2 text-sm text-foreground outline-none hover:bg-secondary/80"
        >
          {languageOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.value === language}
            >
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 text-sm min-w-[160px]">
        <span className="text-xs text-muted-foreground">Style</span>
        <select
          value={translationStyle}
          onChange={(e) => setTranslationStyle(e.target.value as TranslationStyle)}
          className="rounded-md bg-secondary px-3 py-2 text-sm text-foreground outline-none hover:bg-secondary/80"
        >
          <option value="idiomatic">Idiomatic</option>
          <option value="literal">Literal</option>
        </select>
      </div>
    </div>

    {/* Right: action buttons */}
    <div className="flex flex-row flex-nowrap items-center justify-end gap-4 md:ml-auto">
  <Button
    onClick={handleTranslate}
    disabled={isTranslating}
    className="h-10 px-5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
  >
    {isTranslating ? "Translating..." : "Translate Code"}
  </Button>

  <Button
    onClick={handleSubmitCode}
    className="h-10 px-5 shrink-0 bg-green-600 text-white hover:bg-green-700"
  >
    Submit
  </Button>
</div>
  </div>

  {translationError && (
    <p className="mt-3 text-sm text-destructive">{translationError}</p>
  )}
</div>

      {translation && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Translation to {targetLanguageLabel} ({translation.provider}
                {translation.cached ? ", cached" : ""})
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyTranslation}
                >
                  Copy
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReplaceEditor}
                >
                  Replace Editor
                </Button>
              </div>
            </div>
            <textarea
              value={translation.translatedCode}
              readOnly
              className="h-32 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
