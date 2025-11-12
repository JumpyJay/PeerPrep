"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  username: string;
  email: string;
}

export default function EditProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/v1/user/profile", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setUser(data);
        setNewUsername(data.username);
      });
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // update username
      const resUsername = await fetch("/api/v1/user/update-username", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
            username: newUsername, 
            email: user.email,
        }),
      });

      if (!resUsername.ok) throw new Error("Failed to update username");

      // update password if provided
      if (newPassword) {
        const resPassword = await fetch("/api/v1/user/update-password", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            password: newPassword,
            email: user.email,
          }),
        });
        if (!resPassword.ok) throw new Error("Failed to update password");
      }

      alert("Profile updated successfully!");
      router.push("/user/profile");
    } catch (err: unknown) {
        if (err instanceof Error) {
          alert(err.message);
        } else {
          alert("An unexpected error occurred");
        }
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <Link
            href="/"
            className="text-2xl font-bold text-foreground hover:opacity-80 transition"
          >
            PeerPrep
          </Link>
          <p className="text-sm text-muted-foreground">
            Collaborative Problem Solving
          </p>
        </div>
      </header>

      {/* Edit Profile Form */}
      <div className="max-w-md w-full mx-auto mt-8 bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-center">Edit Profile</h2>
        <form className="space-y-4" onSubmit={handleUpdate}>
          <div>
            <label className="block mb-1 font-medium">Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
              placeholder="Leave blank to keep current password"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-black text-white py-2 rounded-lg hover:opacity-80 transition"
          >
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
