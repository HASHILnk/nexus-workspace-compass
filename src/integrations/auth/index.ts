import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import type { OAuthProvider } from "@lovable.dev/cloud-auth-js";
import { supabase } from "../supabase/client";

const authClientInstance = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const auth = {
  signInWithOAuth: async (provider: OAuthProvider, opts?: SignInOptions) => {
    const result = await authClientInstance.signInWithOAuth(provider, {
      ...opts,
      extraParams: {
        ...opts?.extraParams,
      },
    });

    if (result.redirected) {
      return result;
    }

    if (result.error) {
      return result;
    }

    try {
      await supabase.auth.setSession(result.tokens);
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
    return result;
  },
};

export const cloudAuth = { auth };
export const lovable = cloudAuth;
