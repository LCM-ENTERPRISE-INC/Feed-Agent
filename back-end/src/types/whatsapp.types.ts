/**
 * WhatsApp connection state enum.
 * Mirrors the possible values of Baileys' `ConnectionState.connection` field.
 */
export enum WaConnectionState {
  /** Socket created, handshake in progress. */
  CONNECTING  = 'connecting',
  /** Fully authenticated and ready to send/receive messages. */
  OPEN        = 'open',
  /** Disconnected — may reconnect depending on the reason. */
  CLOSE       = 'close',
}

/**
 * Snapshot of the current WhatsApp connection health.
 * Returned by `WhatsAppService.getStatus()`.
 */
export interface WaStatus {
  state:       WaConnectionState;
  qrCode?:     string;   // Base64 PNG, present only while awaiting scan
  lastUpdated: Date;
}
