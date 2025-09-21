import { z } from 'zod';

export const seatSchema = z.enum(['p1', 'p2']);

export const joinRequestSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  name: z.string().min(1, 'name is required'),
  seat: seatSchema.optional(),
  mode: z.enum(['online', 'hotseat', 'bot']).optional()
});

export type JoinRequest = z.infer<typeof joinRequestSchema>;

export const startRequestSchema = z.object({
  roomId: z.string().min(1, 'roomId is required')
});

export type StartRequest = z.infer<typeof startRequestSchema>;

export const discardRequestSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  cardIds: z.array(z.string().min(1)).length(2, 'Exactly two cards must be discarded')
});

export type DiscardRequest = z.infer<typeof discardRequestSchema>;

export const cutRequestSchema = z.object({
  roomId: z.string().min(1, 'roomId is required')
});

export type CutRequest = z.infer<typeof cutRequestSchema>;

export const playRequestSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  cardId: z.string().min(1, 'cardId is required')
});

export type PlayRequest = z.infer<typeof playRequestSchema>;

export const goRequestSchema = z.object({
  roomId: z.string().min(1, 'roomId is required')
});

export type GoRequest = z.infer<typeof goRequestSchema>;

export const resolveRequestSchema = z.object({
  roomId: z.string().min(1, 'roomId is required')
});

export type ResolveRequest = z.infer<typeof resolveRequestSchema>;

export const errorPayloadSchema = z.object({
  code: z.string(),
  msg: z.string()
});

export type ErrorPayload = z.infer<typeof errorPayloadSchema>;

