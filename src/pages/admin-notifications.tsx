import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminNotificationsPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/admin/dashboard?tab=notifications", { replace: true });
  }, [navigate]);
  return null;
}
