import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types for better TypeScript support
export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          name: string;
          creator_id: string;
          qr_code_token: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          creator_id: string;
          qr_code_token?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          creator_id?: string;
          qr_code_token?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      members: {
        Row: {
          id: string;
          session_id: string;
          user_id: string | null;
          name: string;
          payment_method_type:
            | "qr_code"
            | "cash"
            | "bank_transfer"
            | "gcash"
            | "paymaya"
            | "other";
          payment_qr_image_url: string | null;
          payment_notes: string | null;
          added_by_user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id?: string | null;
          name: string;
          payment_method_type?:
            | "qr_code"
            | "cash"
            | "bank_transfer"
            | "gcash"
            | "paymaya"
            | "other";
          payment_qr_image_url?: string | null;
          payment_notes?: string | null;
          added_by_user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string | null;
          name?: string;
          payment_method_type?:
            | "qr_code"
            | "cash"
            | "bank_transfer"
            | "gcash"
            | "paymaya"
            | "other";
          payment_qr_image_url?: string | null;
          payment_notes?: string | null;
          added_by_user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          session_id: string;
          name: string;
          description: string | null;
          total_amount: number;
          created_by_user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          name: string;
          description?: string | null;
          total_amount: number;
          created_by_user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          name?: string;
          description?: string | null;
          total_amount?: number;
          created_by_user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_payers: {
        Row: {
          id: string;
          order_id: string;
          member_id: string;
          amount_paid: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          member_id: string;
          amount_paid: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          member_id?: string;
          amount_paid?: number;
          created_at?: string;
        };
      };
      order_consumers: {
        Row: {
          id: string;
          order_id: string;
          member_id: string;
          split_ratio: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          member_id: string;
          split_ratio?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          member_id?: string;
          split_ratio?: number;
          created_at?: string;
        };
      };
    };
  };
};
