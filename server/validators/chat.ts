import { z } from "zod";

export const sendMessageSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required"),
  content: z
    .string()
    .min(1, "Pesan tidak boleh kosong")
    .max(2000, "Pesan maksimal 2000 karakter"),
});

export const messagePollSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
  after: z.string().optional(),
  before: z.string().optional(),
});

export const searchSchema = z.object({
  q: z.string().min(3, "Minimal 3 karakter untuk pencarian"),
  page: z.coerce.number().int().positive().optional().default(1),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessagePollInput = z.infer<typeof messagePollSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
