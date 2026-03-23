// WaSender webhook payload shapes
// https://wasenderapi.com/api-docs

export interface WaSenderKey {
  id: string;
  fromMe: boolean;
  remoteJid: string; // e.g. "221771234567@s.whatsapp.net"
}

export interface WaSenderButtonResponse {
  selectedButtonId: string;
  selectedDisplayText: string;
}

export interface WaSenderListResponse {
  singleSelectReply: {
    selectedRowId: string;
  };
}

export interface WaSenderMessage {
  key: WaSenderKey;
  pushName?: string;
  messageTimestamp: number;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    buttonsResponseMessage?: WaSenderButtonResponse;
    listResponseMessage?: WaSenderListResponse;
    imageMessage?: { caption?: string };
    documentMessage?: { caption?: string; mimetype?: string };
  };
}

export interface WaSenderWebhookPayload {
  event: string; // 'messages.upsert' | 'messages.update' | 'qr' | ...
  data: {
    messages?: WaSenderMessage[];
  };
}
