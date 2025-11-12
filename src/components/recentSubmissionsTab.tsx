"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { decodeJwtPayload } from "@/lib/decodeJWT";
import { Submission } from "@/modules/collaboration/session.types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import getInitialsFromEmail from "@/lib/getInitials";
import SubmissionDetailsView from "@/app/collaboration/components/submissionDetailView";
import { useRouter } from "next/navigation";

export default function RecentSubmissionsTab() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // initialise router
  const router = useRouter();

  useEffect(() => {
    console.log("fetching submissions");
    const myToken = Cookies.get("token");
    if (!myToken) {
      setError("Not authenticated. Please log in.");
      setLoading(false);
      return;
    }
    const payload = decodeJwtPayload(myToken);
    const email = typeof payload?.id === "string" ? payload.id : "";

    if (!email) {
      setError("Could not validate user from token.");
      setLoading(false);
      return;
    }

    const fetchSubmissions = async (email: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          "/api/v1/collaboration?type=findsubmissionbyuser",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_email: email,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data: Submission[] = await response.json();
        setSubmissions(data);
      } catch (error) {
        console.log("error: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions(email);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading submissions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white pb-4">
            Recent Submissions
          </h3>
          <Button
            className="bg-white-200 text-gray-700 hover:bg-gray-100 font-semibold outline-none mb-4 px-3"
            onClick={() => router.push("/collaboration/submissions")}
          >
            &gt;
          </Button>
        </div>

        {submissions.length === 0 && (
          <Card className="text-center p-12">
            <CardTitle className="text-gray-700 dark:text-gray-300">
              No Submissions Yet
            </CardTitle>
            <CardDescription className="mt-2">
              When you complete a session, your submission will appear here.
            </CardDescription>
          </Card>
        )}

        <ul className="space-y-2">
          {[...submissions]
            // get only top 5
            .slice(0, 3)
            // sort by most recent
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            )
            .map((submission) => (
              <li key={submission.submission_id}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>
                          Question ID: {submission.question_id}
                        </CardTitle>
                        <CardDescription>
                          Submitted on:{" "}
                          {new Date(submission.created_at).toLocaleString()}
                        </CardDescription>
                      </div>
                      <div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button>View Details</Button>
                          </DialogTrigger>
                          <DialogContent className="min-w-3xl max-w-5xl">
                            <SubmissionDetailsView submission={submission} />
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex items-center space-x-3 min-w-0">
                        <Avatar>
                          <AvatarFallback>
                            {getInitialsFromEmail(submission.user1_email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="truncate">
                          <p className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">
                            {submission.user1_email}
                          </p>
                        </div>
                      </div>

                      <Users
                        className="h-5 w-5 text-gray-400 flex-shrink-0"
                        aria-label="with"
                      />

                      <div className="flex items-center space-x-3 min-w-0">
                        <Avatar>
                          <AvatarFallback>
                            {getInitialsFromEmail(submission.user2_email)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="truncate">
                          <p className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">
                            {submission.user2_email}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
