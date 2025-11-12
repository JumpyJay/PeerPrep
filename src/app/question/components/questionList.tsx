"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QuestionCard from "./questionCard";
import type { Question } from "@/modules/question/question.types";

const MOCK_QUESTIONS: Question[] = [
  {
    question_id: 1,
    question_title: "Two Sum",
    question_body:
      "Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target.",
    difficulty: "Easy",
    tags: ["Array", "Hash Table"],
    code_solution:
      "def twoSum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i\n    return []",
  },
  {
    question_id: 2,
    question_title: "Reverse String",
    question_body:
      "Write a function that reverses a string. The input string is given as an array of characters s.",
    difficulty: "Easy",
    tags: ["String", "Two Pointers"],
    code_solution: "def reverseString(s):\n    s.reverse()\n    return s",
  },
  {
    question_id: 3,
    question_title: "Longest Substring Without Repeating Characters",
    question_body:
      "Given a string s, find the length of the longest substring without repeating characters.",
    difficulty: "Medium",
    tags: ["String", "Sliding Window", "Hash Table"],
    code_solution:
      "def lengthOfLongestSubstring(s):\n    char_index = {}\n    max_length = 0\n    start = 0\n    for i, char in enumerate(s):\n        if char in char_index and char_index[char] >= start:\n            start = char_index[char] + 1\n        char_index[char] = i\n        max_length = max(max_length, i - start + 1)\n    return max_length",
  },
  {
    question_id: 4,
    question_title: "Median of Two Sorted Arrays",
    question_body:
      "Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.",
    difficulty: "Hard",
    tags: ["Array", "Binary Search", "Divide and Conquer"],
    code_solution:
      "def findMedianSortedArrays(nums1, nums2):\n    merged = sorted(nums1 + nums2)\n    n = len(merged)\n    if n % 2 == 1:\n        return float(merged[n // 2])\n    return (merged[n // 2 - 1] + merged[n // 2]) / 2",
  },
  {
    question_id: 5,
    question_title: "Valid Parentheses",
    question_body:
      'Given a string s containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid.',
    difficulty: "Easy",
    tags: ["String", "Stack"],
    code_solution:
      'def isValid(s):\n    stack = []\n    pairs = {"(": ")", "{": "}", "[": "]"}\n    for char in s:\n        if char in pairs:\n            stack.append(char)\n        else:\n            if not stack or pairs[stack.pop()] != char:\n                return False\n    return len(stack) == 0',
  },
  {
    question_id: 6,
    question_title: "Merge k Sorted Lists",
    question_body:
      "You are given an array of k linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.",
    difficulty: "Hard",
    tags: ["Linked List", "Divide and Conquer", "Heap"],
    code_solution:
      "import heapq\ndef mergeKLists(lists):\n    heap = []\n    for i, lst in enumerate(lists):\n        if lst:\n            heapq.heappush(heap, (lst.val, i, lst))\n    dummy = ListNode(0)\n    current = dummy\n    while heap:\n        val, i, node = heapq.heappop(heap)\n        current.next = node\n        current = current.next\n        if node.next:\n            heapq.heappush(heap, (node.next.val, i, node.next))\n    return dummy.next",
  },
];

export default function QuestionList({
  onSelectQuestion,
}: {
  onSelectQuestion: (q: Question) => void;
}) {
  const [questions, setQuestions] = useState<Question[]>(MOCK_QUESTIONS);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("All");

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      q.question_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.tags.some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesDifficulty =
      difficultyFilter === "All" || q.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  // define on mount to load question data from api endpoint
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/v1/question", {
          headers: { Authorization: "Bearer readerToken" },
        });

        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data: Question[] = await response.json();
        setQuestions(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        setLoading(false);
      }
    };

    // call the fetch function when mounts
    fetchQuestions();
  }, []);

  // conditional rendering to show loading
  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-foreground">
            LeetCode Questions
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse and explore coding problems
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Input
              placeholder="Search by question_title or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <div className="flex gap-2">
              {["All", "Easy", "Medium", "Hard"].map((difficulty) => (
                <Button
                  key={difficulty}
                  variant={
                    difficultyFilter === difficulty ? "default" : "outline"
                  }
                  onClick={() => setDifficultyFilter(difficulty)}
                  className="whitespace-nowrap"
                >
                  {difficulty}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Questions Grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredQuestions.map((question) => (
            <QuestionCard
              key={question.question_id}
              question={question}
              onViewDetails={() => onSelectQuestion(question)}
            />
          ))}
        </div>
        {filteredQuestions.length === 0 && (
          <div className="flex items-center justify-center rounded-lg border border-border bg-card py-12">
            <p className="text-muted-foreground">No questions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
