/**
 * Realtime Service Type Definitions (Phase 2K)
 * Realtime channel state, events, payload wrappers, and listeners.
 */

import type { Activity} from '../../db/types';

export type RealtimeConnectionStatus =
  | 'SUBSCRIBING'
  | 'SUBSCRIBED'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

export type RealtimeEventType =
  | 'LEAD_CREATED'
  | 'LEAD_UPDATED'
  | 'LEAD_ASSIGNED'
  | 'LEAD_REASSIGNED'
  | 'LEAD_UNASSIGNED'
  | 'CALL_INITIATED'
  | 'CALL_COMPLETED'
  | 'CALL_CANCELLED'
  | 'CALL_OUTCOME_RECORDED'
  | 'FOLLOW_UP_CREATED'
  | 'FOLLOW_UP_UPDATED'
  | 'FOLLOW_UP_COMPLETED'
  | 'FOLLOW_UP_RESCHEDULED'
  | 'REMARK_CREATED'
  | 'MESSAGE_INITIATED'
  | 'MESSAGE_FAILED'
  | 'AGENT_CREATED'
  | 'AGENT_UPDATED'
  | 'AGENT_ACTIVATED'
  | 'AGENT_DEACTIVATED'
  | 'IMPORT_COMPLETED';

export interface RealtimeInAppNotification {
  id: string;
  type: 'ASSIGNMENT' | 'CALL' | 'FOLLOW_UP' | 'LEAD_UPDATE' | 'INFO';
  title: string;
  message: string;
  timestamp: string;
  leadId?: string;
  actorName?: string;
  read?: boolean;
}

export type RealtimeStatusListener = (status: RealtimeConnectionStatus) => void;
export type RealtimeActivityListener = (activity: Activity) => void;
export type RealtimeNotificationListener = (notification: RealtimeInAppNotification) => void;
export type RealtimeEntityListener = (table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', record: unknown) => void;
