import { supabase } from '@/lib/supabase';
export const callFn = async (body: Record<string, any>): Promise<any> => {
  if (!body?.action) {
    throw new Error('callFn: missing action field');
  }
  const session = await supabase.auth.getSession();
  const accessToken = session.data?.session?.access_token;
  const invokeOptions: any = { body };
  if (accessToken) {
    invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };
  }
  const { data, error } = await supabase.functions.invoke('mindmates', invokeOptions);
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.body) {
        const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
        detail = parsed?.error ?? detail;
      }
    } catch {}
    throw new Error(detail);
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data;
};
export default callFn;


