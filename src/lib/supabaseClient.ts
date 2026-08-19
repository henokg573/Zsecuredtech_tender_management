import { createClient } from "@supabase/supabase-js";
import { projectId as _projectId, publicAnonKey as _publicAnonKey } from "../../utils/supabase/info";

// Allow overriding via Vite env variables for local dev: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
const ENV_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_URL) || undefined;
const ENV_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_ANON_KEY) || undefined;

const projectId = _projectId || '';
const publicAnonKey = _publicAnonKey || '';
const SUPABASE_URL = ENV_URL || (projectId ? `https://${projectId}.supabase.co` : '');
const SUPABASE_ANON_KEY = ENV_KEY || publicAnonKey || '';

let supabase: any = null;
let SUPABASE_ENABLED = false;
if (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('pzvxizr')) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    SUPABASE_ENABLED = true;
  } catch (err) {
    console.warn('Failed to create Supabase client, disabling remote calls:', err);
    supabase = null;
    SUPABASE_ENABLED = false;
  }
} else {
  console.warn('Supabase not configured or uses placeholder projectId; remote calls disabled. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable.');
}

export async function signIn(email: string, password: string) {
  if (!SUPABASE_ENABLED || !supabase) return null;
  try {
    const res = await supabase.auth.signInWithPassword({ email, password });
    return res;
  } catch (err) {
    console.error('Supabase signIn error', err);
    return null;
  }
}

export async function signUp(email: string, password: string, options?: any) {
  if (!SUPABASE_ENABLED || !supabase) return null;
  try {
    const res = await supabase.auth.signUp({ email, password }, options);
    return res;
  } catch (err) {
    console.error('Supabase signUp error', err);
    return null;
  }
}

export { supabase };

export async function signOut() {
  if (!SUPABASE_ENABLED || !supabase) return null;
  try {
    const res = await supabase.auth.signOut();
    return res;
  } catch (err) {
    console.error('Supabase signOut error', err);
    return null;
  }
}

export async function getSession() {
  if (!SUPABASE_ENABLED || !supabase) return null;
  try {
    const res = await supabase.auth.getSession();
    return res?.data?.session || null;
  } catch (err) {
    console.error('Supabase getSession error', err);
    return null;
  }
}

export function onAuthStateChange(cb: (event: any, session: any) => void) {
  if (!SUPABASE_ENABLED || !supabase) {
    return { data: { subscription: null }, error: null };
  }
  return supabase.auth.onAuthStateChange((event, session) => cb(event, session));
}

export async function fetchTable(table: string) {
  if (!SUPABASE_ENABLED || !supabase) return null;
  try {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Supabase fetch error:", err);
    return null;
  }
}

export async function insertRow(table: string, row: any) {
  if (!SUPABASE_ENABLED || !supabase) return null;
  try {
    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Supabase insert error:", err);
    return null;
  }
}

export async function updateRow(table: string, idField: string, idValue: any, updates: any) {
  if (!SUPABASE_ENABLED || !supabase) return null;
  try {
    const { data, error } = await supabase.from(table).update(updates).eq(idField, idValue).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Supabase update error:", err);
    return null;
  }
}

export async function deleteRow(table: string, idField: string, idValue: any) {
  if (!SUPABASE_ENABLED || !supabase) return false;
  try {
    const { error } = await supabase.from(table).delete().eq(idField, idValue);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Supabase delete error:", err);
    return false;
  }
}
