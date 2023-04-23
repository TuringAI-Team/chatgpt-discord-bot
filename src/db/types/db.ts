import { Snowflake } from "discord.js";

import { DatabaseUserInfraction, DatabaseSubscription, DatabaseSubscriptionType, DatabaseConversationMessage, DatabaseGuildSubscription } from "../managers/user.js";
import { SerializedModerationResult } from "../../conversation/moderation/moderation.js";
import { DatabaseImage } from "../../image/types/image.js";

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: {
          active: boolean
          created: string
          history: DatabaseConversationMessage[] | null
          id: string
          tone: string
        }
        Insert: {
          active: boolean
          created?: string
          history?: DatabaseConversationMessage[] | null
          id: string
          tone: string
        }
        Update: {
          active?: boolean
          created?: string
          history?: DatabaseConversationMessage[] | null
          id?: string
          tone?: string
        }
      }
      cooldown: {
        Row: {
          created: string
          id: string
          name: string
        }
        Insert: {
          created?: string
          id: string
          name: string
        }
        Update: {
          created?: string
          id?: string
          name?: string
        }
      }
      interactions: {
        Row: {
          id: string
          conversation: string
          requestedAt: string
          completedAt: string
          input: string
          output: string
          tone: string
          inputModeration: SerializedModerationResult
          outputModeration: SerializedModerationResult
          suggestions: string[]
        }
        Insert: {
          id: string
          conversation: string
          requestedAt: string
          completedAt: string
          input: string
          output: string
          tone: string
          inputModeration: SerializedModerationResult | null
          outputModeration: SerializedModerationResult | null
          suggestions: string[]
        }
        Update: {
          id?: string
          conversation?: string
          requestedAt?: string
          completedAt?: string
          input?: string
          output?: string
          tone?: string
          inputModeration?: SerializedModerationResult
          outputModeration?: SerializedModerationResult
          suggestions?: string[]
        }
      }
      users: {
        Row: {
          id: Snowflake
          created: string
          moderator: boolean      
          interactions: number
          infractions: DatabaseUserInfraction[]
          subscription: DatabaseSubscription | null
          acceptedTerms: boolean
        }
        Insert: {
          id: Snowflake
          created?: string
          moderator: boolean      
          interactions: number
          infractions: DatabaseUserInfraction[]
          subscription: DatabaseSubscription | null
          acceptedTerms: boolean
        }
        Update: {
          id?: Snowflake
          created?: string
          moderator?: boolean      
          interactions?: number
          infractions?: DatabaseUserInfraction[]
          subscription?: DatabaseSubscription | null
          acceptedTerms?: boolean
        }
      }
      keys: {
        Row: {
          key: string
          created: string
          type: DatabaseSubscriptionType
          duration: number
        }
        Insert: {
          key: string
          created?: string
          type: DatabaseSubscriptionType
          duration: number
        }
        Update: {
          key?: string
          created?: string
          type?: DatabaseSubscriptionType
          duration?: number
        }
      }
      guilds: {
        Row: {
          id: Snowflake
          created: string
          subscription: DatabaseGuildSubscription | null
        }
        Insert: {
          id: Snowflake
          created?: string
          subscription?: DatabaseGuildSubscription | null
        }
        Update: {
          id?: Snowflake
          created?: string
          subscription?: DatabaseGuildSubscription | null
        }
      }
      images: {
        Row: DatabaseImage
        Insert: DatabaseImage
        Update: Partial<DatabaseImage>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
