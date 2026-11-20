/**
 * VoiceNotification.ts - Voice Notification Handler
 *
 * PURPOSE:
 * Sends completion messages to the voice server for TTS playback.
 * Extracts the 🗣️ voice line from responses and sends it to Pulse /notify; the server picks
 * the engine (Fish clone when configured, else the local speech endpoint).
 *
 * Pure handler: receives pre-parsed transcript data, sends to voice server.
 * No I/O for transcript reading - that's done by VoiceCompletion.hook.ts.
 */

import { existsSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { lifeosPath } from '../lib/paths';
import { getIdentity, type VoicePersonality } from '../lib/identity';
import { getISOTimestamp } from '../lib/time';
import { isValidVoiceCompletion, getVoiceFallback } from '../lib/output-validators';
import { findActiveSessionByUUID } from '../lib/isa-utils';

import type { ParsedTranscript } from '../../LIFEOS/TOOLS/TranscriptParser';
import { PULSE_BASE } from '../../LIFEOS/PULSE/endpoint';

const DA_IDENTITY = getIdentity();

// Voice notification payload; the voice server speaks it on Fish with the clone behind voice_id
interface NotificationPayload {
  message: string;
  title?: string;
  voice_enabled?: boolean;
  voice_id?: string;
  volume?: number;
  /** Voice mode: the server stops this clip when a talk mic opens, and answers once it is queued. */
  interruptible?: boolean;
}

interface VoiceEvent {
  timestamp: string;
  session_id: string;
  event_type: 'sent' | 'failed' | 'skipped';
  message: string;
  character_count: number;
  /** The voice server picks the engine (Fish when key+clone, else the local speech endpoint); this record names the bus it was sent on. */
  voice_engine: 'pulse';
  voice_id: string;
  status_code?: number;
  error?: string;
}

const VOICE_LOG_PATH = lifeosPath('MEMORY', 'VOICE', 'voice-events.jsonl');

/**
 * Resolve the active session's work dir for echoing voice events into a
 * per-session `voice.jsonl`. Source of truth is MEMORY/STATE/work.json,
 * matched by sessionUUID. Returns null when no active row exists — the
 * voice event still lands in the global voice-events.jsonl above.
 */
function getActiveWorkDir(sessionId: string): string | null {
  try {
    const active = findActiveSessionByUUID(sessionId);
    if (!active) return null;
    const workPath = lifeosPath('MEMORY', 'WORK', active.slug);
    return existsSync(workPath) ? workPath : null;
  } catch {
    return null;
  }
}

function logVoiceEvent(event: VoiceEvent): void {
  const line = JSON.stringify(event) + '\n';

  try {
    const dir = lifeosPath('MEMORY', 'VOICE');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    appendFileSync(VOICE_LOG_PATH, line);
  } catch {
    // Silent fail
  }

  try {
    const workDir = event.session_id ? getActiveWorkDir(event.session_id) : null;
    if (workDir) {
      appendFileSync(join(workDir, 'voice.jsonl'), line);
    }
  } catch {
    // Silent fail
  }
}

async function sendNotification(payload: NotificationPayload, sessionId: string): Promise<void> {
  const voiceId = payload.voice_id || DA_IDENTITY.mainDAVoiceID;

  const baseEvent: Omit<VoiceEvent, 'event_type' | 'status_code' | 'error'> = {
    timestamp: getISOTimestamp(),
    session_id: sessionId,
    message: payload.message,
    character_count: payload.message.length,
    voice_engine: 'pulse',
    voice_id: voiceId,
  };

  try {
    // Use the voice server /notify endpoint
    const response = await fetch(`${PULSE_BASE}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // 10s: Fish TTS takes ~1s (8s server-side timeout). An interruptible clip is answered once queued, but a
      // 480-char spoken field takes longer to generate than a closer, so it gets 20s.
      signal: AbortSignal.timeout(payload.interruptible ? 20000 : 10000),
    });

    if (!response.ok) {
      console.error('[Voice] Server error:', response.statusText);
      logVoiceEvent({
        ...baseEvent,
        event_type: 'failed',
        status_code: response.status,
        error: response.statusText,
      });
    } else {
      logVoiceEvent({
        ...baseEvent,
        event_type: 'sent',
        status_code: response.status,
      });

    }
  } catch (error) {
    console.error('[Voice] Failed to send:', error);
    logVoiceEvent({
      ...baseEvent,
      event_type: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle voice notification with pre-parsed transcript data.
 * Speaks via Pulse /notify; the server picks the engine.
 */
export async function handleVoice(parsed: ParsedTranscript, sessionId: string, opts?: { interruptible?: boolean; spoken?: boolean }): Promise<void> {
  let voiceCompletion = parsed.voiceCompletion;

  // Voice mode with nothing to say stays silent rather than speaking a stock fallback.
  if (opts?.interruptible && !voiceCompletion?.trim()) return;

  // Validate voice completion. A voice-mode SPOKEN field is prose written for the ear and is
  // spoken as written; the closer validator's conversational-starter bans would replace it.
  if (!opts?.spoken && !isValidVoiceCompletion(voiceCompletion)) {
    console.error(`[Voice] Invalid completion: "${voiceCompletion.slice(0, 50)}..."`);
    voiceCompletion = getVoiceFallback();
  }

  // Skip empty or too-short messages
  if (!voiceCompletion || voiceCompletion.length < 5) {
    console.error('[Voice] Skipping - message too short or empty');
    return;
  }

  // The voice id is the key the voice server resolves to a configured voice (Fish clone or local name)
  const payload: NotificationPayload = {
    message: voiceCompletion,
    title: `${DA_IDENTITY.name} says`,
    voice_enabled: true,
    voice_id: DA_IDENTITY.mainDAVoiceID,
    ...(opts?.interruptible ? { interruptible: true } : {}),
  };

  await sendNotification(payload, sessionId);
}
