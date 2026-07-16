// src/hooks/useNotifications.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";

export interface AppNotification {
  id: number;
  verb: string;
  message: string;
  related_app: string;
  related_model: string;
  related_id: number | null;
  site_id: string;
  year: number | null;
  month: number | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsPage {
  count: number;
  unread_count: number;
  page: number;
  page_size: number;
  pages: number;
  results: AppNotification[];
}

async function fetchNotifications(): Promise<NotificationsPage> {
  const { data } = await api.get("/core/notifications/", { params: { page_size: 20 } });
  return data;
}

export function useNotifications() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 45_000,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => api.post(`/core/notifications/${id}/read/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post("/core/notifications/mark-all-read/"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return {
    notifications: query.data?.results ?? [],
    unreadCount: query.data?.unread_count ?? 0,
    isLoading: query.isLoading,
    markRead: (id: number) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
  };
}
