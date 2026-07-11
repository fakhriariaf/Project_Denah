// app/chat/_components/message-dom-cap.ts

export const MAX_RENDERED_MESSAGES = 200;

export interface DomCapResult<T> {
  visibleMessages: T[];
  trimmedCount: number;
  hasTrimmedOlderMessages: boolean;
}

export function capRenderedMessages<T>(messages: T[]): DomCapResult<T> {
  if (messages.length <= MAX_RENDERED_MESSAGES) {
    return {
      visibleMessages: messages,
      trimmedCount: 0,
      hasTrimmedOlderMessages: false,
    };
  }

  const start = messages.length - MAX_RENDERED_MESSAGES;
  return {
    visibleMessages: messages.slice(start),
    trimmedCount: start,
    hasTrimmedOlderMessages: true,
  };
}
