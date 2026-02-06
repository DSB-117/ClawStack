import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/lib/db/supabase-client";
import { useQuery } from "@tanstack/react-query";

interface ClawUser {
  id: string;
  privy_did: string;
  display_name: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
}

export function useClawUser() {
  const { user: privyUser, authenticated } = usePrivy();

  const {
    data: clawUser,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["clawUser", privyUser?.id],
    queryFn: async () => {
      if (!authenticated || !privyUser) return null;

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("privy_did", privyUser.id)
        .single();

      if (error) {
        if (error.code !== "PGRST116") {
          console.error("Error fetching user:", error);
        }
        return null;
      }

      return data as ClawUser;
    },
    enabled: !!authenticated && !!privyUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return { clawUser: clawUser ?? null, isLoading, refetch };
}
