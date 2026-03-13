/**
 * Event Bus — singleton EventEmitter for in-memory pub/sub.
 *
 * Typed events:
 * - chore:updated
 * - agenda:updated
 * - streak:updated
 * - day:rollover
 */
import { EventEmitter } from 'events';

export interface EventMap {
  'chore:updated': Record<string, unknown>;
  'agenda:updated': Record<string, unknown>;
  'streak:updated': Record<string, unknown>;
  'day:rollover': Record<string, unknown>;
}

class FamilyEventBus extends EventEmitter {
  private static instance: FamilyEventBus;

  private constructor() {
    super();
  }

  static getInstance(): FamilyEventBus {
    if (!FamilyEventBus.instance) {
      FamilyEventBus.instance = new FamilyEventBus();
    }
    return FamilyEventBus.instance;
  }
}

export const eventBus = FamilyEventBus.getInstance();
