"use client";
import { useState, useEffect } from "react";
import Stats from "@/components/Dashboard/Stats";
import FollowUpList from "@/components/Dashboard/FollowUpList";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function Dashboard() {
  const [stats, setStats] = useState({
    sentToday: 0,
    opened: 0,
    replied: 0,
  });
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Get today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayData, error: todayError } = await supabase
        .from("outreach_history")
        .select("*")
        .gte("sent_at", today.toISOString());

      if (todayError) throw todayError;

      const opened = todayData.filter(
        (item) => item.status === "opened"
      ).length;
      const replied = todayData.filter(
        (item) => item.status === "replied"
      ).length;

      setStats({
        sentToday: todayData.length,
        opened,
        replied,
      });

      // Get follow-ups needed
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: followUpData, error: followUpError } = await supabase
        .from("outreach_history")
        .select("*, contacts(*)")
        .lte("sent_at", threeDaysAgo.toISOString())
        .neq("status", "replied")
        .order("sent_at", { ascending: true })
        .limit(10);

      if (followUpError) throw followUpError;

      setFollowUps(followUpData || []);
    } catch (error) {
      toast.error("Error loading dashboard data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      <Stats stats={stats} loading={loading} />

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Need Follow-up ({followUps.length})
        </h2>
        <FollowUpList followUps={followUps} onFollowUp={fetchDashboardData} />
      </div>
    </div>
  );
}
