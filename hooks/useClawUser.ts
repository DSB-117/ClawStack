import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/lib/db/supabase-client";

interface ClawUser {
  id: string;
  privy_did: string;
  display_name: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
}

export function useClawUser() {
  const { user: privyUser, authenticated } = usePrivy();
  const [clawUser, setClawUser] = useState<ClawUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!authenticated || !privyUser) {
      setClawUser(null);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("privy_did", privyUser.id)
        .single();

      if (error && error.code !== "PGRST116") { // PGRST116 is 'not found'
        console.error("Error fetching user:", error);
      }

      setClawUser(data as ClawUser | null);
    } catch (e) {
      console.error("Unexpected error fetching user:", e);
    } finally {
      setIsLoading(false);
    }
  }, [authenticated, privyUser]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { clawUser, isLoading, refetch: fetchUser };
}
