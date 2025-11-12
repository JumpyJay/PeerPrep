// /src/modules/chat/chat.types.ts

export interface ChatMessage {
    id: string;           // uuid
    session_id: number;   // integer
    sender_email: string;
    content: string;
    created_at: string;   // ISO
}