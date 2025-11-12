import { getConnectionPool } from "@/lib/db";
import { ChatMessage } from "./chat.types";

export const chatService = {
    async list(sessionId: number, since?: string, limit = 100): Promise<ChatMessage[]> {
        const pool = await getConnectionPool();
        if (since) {
            const { rows } = await pool.query<ChatMessage>(
                `
                SELECT id, session_id, sender_email, content, created_at
                FROM chat_message
                WHERE session_id = $1 AND created_at > $2::timestamptz
                ORDER BY created_at ASC
                LIMIT $3
                `,
                [sessionId, since, limit]
            );
            return rows;
        } else {
            const { rows } = await pool.query<ChatMessage>(
                `
                SELECT id, session_id, sender_email, content, created_at
                FROM chat_message
                WHERE session_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                `,
                [sessionId, limit]
            );
            return rows.reverse(); // oldest -> newest for rendering
        }
    },

    async create(sessionId: number, senderEmail: string, content: string): Promise<ChatMessage> {
        const pool = await getConnectionPool();
        const { rows } = await pool.query<ChatMessage>(
            `
            INSERT INTO chat_message (session_id, sender_email, content)
            VALUES ($1, $2, $3)
            RETURNING id, session_id, sender_email, content, created_at
            `,
            [sessionId, senderEmail, content]
        );
        return rows[0];
    },
};