"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Stats from "@/components/Dashboard/Stats";
import FollowUpList from "@/components/Dashboard/FollowUpList";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState({ sentToday: 0, opened: 0, replied: 0 });
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchDashboard();
    }
  }, [session]);

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setFollowUps(data.followUps);
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      <Stats stats={stats} loading={loading} />

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Follow-up Needed
        </h2>
        <FollowUpList followUps={followUps} />
      </div>
    </div>
  );
}
