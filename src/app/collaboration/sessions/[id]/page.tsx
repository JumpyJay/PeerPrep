"use client";

import { CodingInterface } from "../../components/codingInterface";
import { useParams } from "next/navigation";

export default function CollaborationPage() {
  const params = useParams();
  const sessionId = Number(params.id);
  return <CodingInterface sessionId={sessionId} />;
}
