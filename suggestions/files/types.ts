export interface Chat {
  id: string;
  name: string;
  handle?: string;
  subtitle?: string;
  lastMessage: string;
  time: string;
  unread: number;
  isGroup?: boolean;
}

export interface Message {
  id: string;
  text: string;
  time: string;
  mine: boolean;
}
