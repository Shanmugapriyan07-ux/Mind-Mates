// lib/callFn.ts
// Single source of truth for all edge function calls.
//
// ROOT CAUSE OF 400 ERROR:
//   WRONG:  body: JSON.stringify(body)   ← double-serializes; edge fn gets string not object
//   WRONG:  headers: {'Content-Type': 'application/json'}  ← Supabase SDK sets this already
//   RIGHT:  body: plainObject            ← SDK serializes once automatically ✅
//
// The Supabase JS SDK's functions.invoke() already:
//   1. JSON.stringifies the body object
//   2. Sets Content-Type: application/json
//   3. Attaches the current session Bearer token
// Doing any of those manually causes double-encoding or header conflicts.

import { supabase } from '@/lib/supabase';

export const callFn = async (body: Record<string, any>): Promise<any> => {
  if (!body?.action) {
    throw new Error('callFn: missing action field');
  }

  // Pass plain object — SDK handles serialization ✅
  const { data, error } = await supabase.functions.invoke('mindmates', { body });

  if (error) {
    // error.message for network/auth errors
    // error.context?.body for edge fn error body
    let detail = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.body) {
        const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
        detail = parsed?.error ?? detail;
      }
    } catch {}
    console.error(`[callFn] ${body.action} failed:`, detail);
    throw new Error(detail);
  }

  if (data?.error) {
    console.error(`[callFn] ${body.action} error:`, data.error);
    throw new Error(data.error);
  }

  return data;
};

export default callFn;