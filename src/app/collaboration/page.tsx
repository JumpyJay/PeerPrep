"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import getInitialsFromEmail from "@/lib/getInitials";
import { Session } from "@/modules/collaboration/session.types";
import { ArrowRight, Trash2 } from "lucide-react"; // Import Trash2
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CollaborationPage() {
  // initiatialise states
  const [openCreateModal, setOpenCreateModal] = useState<boolean>(false);
  const [openFilterModal, setOpenFilterModal] = useState<boolean>(false);
  const [user1Email, setUser1Email] = useState<string>("");
  const [user2Email, setUser2Email] = useState<string>("");
  const [questionID, setQuestionID] = useState<number>(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completeFilter, setCompleteFilter] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteMode, setIsDeleteMode] = useState<boolean>(false); // State for delete toggle
  const router = useRouter();

  const handleDeleteSession = async (sessionid: number) => {
    try {
      const response = await fetch(`/api/v1/collaboration?type=deletesession`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionid,
        }),
      });

      if (response.ok) {
        console.log("session deleted!");
        // update state to remove deleted session from UI
        setSessions((prevSessions) =>
          prevSessions.filter((session) => session.session_id !== sessionid)
        );
      } else {
        console.error("Failed to delete session");
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const handleSubmission = () => {
    console.log("questionID: ", questionID);
    console.log("user1Email: ", user1Email);
    console.log("user2Email: ", user2Email);
    // calls the create session api, with respective type
    fetch("/api/v1/collaboration?type=create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: questionID,
        user1_email: user1Email,
        user2_email: user2Email,
      }),
    });
    console.log("session created");
    setOpenCreateModal(false);
  };

  // const fetchQuestionInfoFromID = (id: string) => {
  // fetch question database and find one of matching id
  // };

  useEffect(() => {
    // on mount fetch all sessions from api endpoint
    const fetchSessions = async () => {
      try {
        // update loading and error state subsequently
        setLoading(true);
        setError(null);

        const response = await fetch("/api/v1/collaboration");

        // if response unsuccessful, throw error
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        // parse the JSON data from the response
        const data: Session[] = await response.json();
        setSessions(data);
      } catch (err) {
        // fetch fails, set error message
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        // fetch done, set loading false
        setLoading(false);
      }
    };

    // call the fetch function when mounts
    fetchSessions();
  }, []);

  // conditional rendering to show load
  if (loading) {
    return <div>Loading users...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-950 min-h-screen p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-row items-center justify-between">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              All Sessions
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {"Here's a list of all currently active user sessions."}
            </p>
          </header>
          <div className="flex space-x-1">
            {/* --- NEW DELETE TOGGLE --- */}
            <Toggle
              size="sm"
              pressed={isDeleteMode}
              onPressedChange={setIsDeleteMode}
              aria-label="Toggle delete mode"
            >
              <Trash2 className="h-4 w-4" />
            </Toggle>

            {/* --- Filter Button --- */}
            <div>
              <Dialog open={openFilterModal} onOpenChange={setOpenFilterModal}>
                <DialogTrigger asChild>
                  <Button size="sm">Filter</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Filter Sessions</DialogTitle>
                    <DialogDescription>
                      This is a simple filter session pop-up.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Toggle onClick={() => setCompleteFilter("complete")}>
                      Completed
                    </Toggle>
                    <Toggle onClick={() => setCompleteFilter("incomplete")}>
                      Not Completed
                    </Toggle>
                    <Toggle onClick={() => setCompleteFilter("all")}>
                      All
                    </Toggle>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* --- Create Button --- */}
            <div>
              <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
                <DialogTrigger asChild>
                  <Button size="sm">Create</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Session</DialogTitle>
                    <DialogDescription>
                      This is a simple create session pop-up.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-foreground">questionID</p>
                    <Input
                      onChange={(e) => setQuestionID(Number(e.target.value))}
                    />

                    <p className="text-foreground">user1_email</p>
                    <Input onChange={(e) => setUser1Email(e.target.value)} />

                    <p className="text-foreground">user2_email</p>
                    <Input onChange={(e) => setUser2Email(e.target.value)} />

                    <Button
                      onClick={() => handleSubmission()}
                      className="w-full"
                    >
                      Create Session
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <ul className="space-y-4">
          {[...sessions]
            .sort((a, b) => a.session_id - b.session_id) // sort ascending by id
            .filter((session) => {
              switch (completeFilter) {
                case "complete":
                  return session.is_completed === true;
                case "incomplete":
                  return session.is_completed === false;
                case "all":
                  return true;
                default:
                  throw new Error(
                    `Invalid filterIsCompleted value: ${completeFilter}`
                  );
              }
            })
            .map((session) => (
              <li key={session.session_id}>
                <Card>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
                      {/* --- user 1 --- */}
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <Avatar>
                          <AvatarFallback>
                            {getInitialsFromEmail(session.user1_email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="truncate">
                          <p className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">
                            {session.user1_email}
                          </p>
                        </div>
                      </div>

                      {/* --- connector --- */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path>
                      </svg>

                      {/* --- user 2 --- */}
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <Avatar>
                          <AvatarFallback>
                            {getInitialsFromEmail(session.user2_email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="truncate">
                          <p className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">
                            {session.user2_email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* --- Session ID + Right Arrow --- */}
                    <div className="flex items-center space-x-3 ml-4">
                      <div className="hidden sm:block text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-md">
                        {session.session_id}
                      </div>

                      {/* Circle Icon */}
                      <div className="hidden sm:block">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="transparent"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`h-5 w-5 ${
                            session.is_completed
                              ? "fill-gray-300"
                              : "fill-green-400"
                          }`}
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                        </svg>
                      </div>

                      {/* --- CONDITIONAL ARROW/DELETE BUTTON --- */}
                      {isDeleteMode ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8" // Made slightly smaller
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will
                                permanently delete the session (ID:{" "}
                                {session.session_id}) for {session.user1_email}{" "}
                                and {session.user2_email}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleDeleteSession(session.session_id)
                                }
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <h3
                          onClick={() =>
                            router.push(
                              `collaboration/sessions/${session.session_id}`
                            )
                          }
                          className="cursor-pointer" // Added for better UX
                        >
                          <ArrowRight
                            className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
                            aria-label="View session details"
                          />
                        </h3>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
        </ul>

        {sessions.length === 0 &&
          !loading && ( // Added !loading check
            <Card className="text-center p-12">
              <CardTitle className="text-gray-700 dark:text-gray-300">
                No Sessions
              </CardTitle>
              <CardDescription>
                When a new session starts, it will appear here.
              </CardDescription>
            </Card>
          )}
      </div>
    </div>
  );
}
