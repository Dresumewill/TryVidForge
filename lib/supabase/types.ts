export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
        };
      };
      videos: {
        Row: {
          id: string;
          user_id: string;
          prompt: string;
          script: string | null;
          audio_url: string | null;
          video_url: string | null;
          status: "pending" | "processing" | "ready" | "failed";
          rendering_job_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          prompt: string;
          script?: string | null;
          audio_url?: string | null;
          video_url?: string | null;
          status?: "pending" | "processing" | "ready" | "failed";
          rendering_job_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          prompt?: string;
          script?: string | null;
          audio_url?: string | null;
          video_url?: string | null;
          status?: "pending" | "processing" | "ready" | "failed";
          rendering_job_id?: string | null;
          created_at?: string;
        };
      };
      credits: {
        Row: {
          user_id: string;
          balance: number;
        };
        Insert: {
          user_id: string;
          balance?: number;
        };
        Update: {
          user_id?: string;
          balance?: number;
        };
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          delta: number;
          reason: string;
          video_id: string | null;
          stripe_session_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          delta: number;
          reason: string;
          video_id?: string | null;
          stripe_session_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          delta?: number;
          reason?: string;
          video_id?: string | null;
          stripe_session_id?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      deduct_credit: {
        Args: { p_user_id: string; p_video_id: string; p_reason?: string };
        Returns: Json;
      };
      refund_credit: {
        Args: { p_user_id: string; p_video_id: string; p_reason?: string };
        Returns: Json;
      };
      grant_credits: {
        Args: { p_user_id: string; p_amount: number; p_reason?: string; p_stripe_session_id?: string | null };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
  };
}

// Convenience row types
export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type VideoRow = Database["public"]["Tables"]["videos"]["Row"];
export type CreditsRow = Database["public"]["Tables"]["credits"]["Row"];
export type CreditTransactionRow =
  Database["public"]["Tables"]["credit_transactions"]["Row"];

export type VideoStatus = VideoRow["status"];

// RPC return shapes
export interface DeductCreditResult {
  ok: boolean;
  error?: "credits_not_found" | "insufficient_credits" | "unauthorized";
  balance?: number;
}
