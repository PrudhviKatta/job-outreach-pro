import { useState } from "react";
import { formatDate, daysAgo } from "@/lib/utils";
import Button from "@/components/UI/Button";
import toast from "react-hot-toast";

export default function FollowUpList({ followUps, onFollowUp }) {
  const [loading, setLoading] = useState(false);

  const handleFollowUp = async (item) => {
    setLoading(true);
    try {
      // Navigate to email page with pre-filled data
      window.location.href = `/email?followUp=${item.id}&contact=${item.contact_id}`;
    } catch (error) {
      toast.error("Error initiating follow-up");
    } finally {
      setLoading(false);
    }
  };

  if (followUps.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">
        No follow-ups needed right now!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {followUps.map((item) => (
        <div
          key={item.id}
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">
                {item.contacts?.name || "Unknown"}
              </h4>
              <p className="text-sm text-gray-600">
                {item.contacts?.company} • Sent {daysAgo(item.sent_at)} days ago
              </p>
              <p className="text-sm text-gray-500 mt-1">{item.subject}</p>
            </div>
            <Button
              onClick={() => handleFollowUp(item)}
              disabled={loading}
              variant="warning"
              size="sm"
            >
              Follow Up
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
