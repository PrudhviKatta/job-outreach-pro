"use client";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import EmailForm from "@/components/Email/EmailForm";
import CampaignProgress from "@/components/Email/CampaignProgress";

export default function EmailPage() {
  const { data: session } = useSession();

  // Campaign setup
  const [templates, setTemplates] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedResume, setSelectedResume] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [dailyEmailCount, setDailyEmailCount] = useState(0);

  // Campaign state
  const [campaignId, setCampaignId] = useState(null);
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [campaignProgress, setCampaignProgress] = useState({
    sent: 0,
    failed: 0,
    pending: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const statusIntervalRef = useRef(null);

  useEffect(() => {
    if (session) {
      fetchTemplates();
      fetchResumes();
      fetchDailyCount();
    }
    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, [session]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates?type=email");
      const data = await res.json();
      if (data.success) setTemplates(data.data);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const fetchResumes = async () => {
    try {
      const res = await fetch("/api/resumes");
      const data = await res.json();
      if (data.success) setResumes(data.data);
    } catch (error) {
      console.error("Error fetching resumes:", error);
    }
  };

  const fetchDailyCount = async () => {
    try {
      const res = await fetch("/api/campaigns/daily-count");
      const data = await res.json();
      if (data.success) setDailyEmailCount(data.count);
    } catch (error) {
      console.error("Error fetching daily count:", error);
    }
  };

  const startCampaign = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }
    if (recipients.length === 0) {
      toast.error("Please add at least one recipient");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/campaigns/start-clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          resumeId: selectedResume || null,
          recipients,
          campaignName: `Campaign ${new Date().toLocaleDateString()}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Campaign started!");
        setCampaignId(data.campaignId);
        setCampaignStatus("sending");
        setRecipients([]);
        startStatusPolling(data.campaignId);
      } else {
        toast.error(data.error || "Failed to start campaign");
      }
    } catch (error) {
      toast.error("Error starting campaign");
    } finally {
      setLoading(false);
    }
  };

  const startStatusPolling = (cId) => {
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);

    const poll = async () => {
      try {
        const res = await fetch(`/api/campaigns/status?campaignId=${cId}`);
        const data = await res.json();
        if (data.success) {
          setCampaignStatus(data.campaign.status);
          setCampaignProgress(data.progress);

          // Stop polling if campaign is done
          if (
            ["completed", "failed", "stopped", "cancelled"].includes(
              data.campaign.status
            )
          ) {
            clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
            fetchDailyCount();
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    poll(); // Immediate first poll
    statusIntervalRef.current = setInterval(poll, 5000);
  };

  const stopCampaign = async () => {
    if (!campaignId) return;
    try {
      const res = await fetch("/api/campaigns/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Campaign stopped");
        setCampaignStatus("stopped");
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
      }
    } catch (error) {
      toast.error("Error stopping campaign");
    }
  };

  const resetCampaign = () => {
    setCampaignId(null);
    setCampaignStatus(null);
    setCampaignProgress({ sent: 0, failed: 0, pending: 0, total: 0 });
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Email Campaign</h1>

      {/* Show campaign progress if active */}
      {campaignId && campaignStatus ? (
        <CampaignProgress
          status={campaignStatus}
          progress={campaignProgress}
          onStop={stopCampaign}
          onReset={resetCampaign}
        />
      ) : (
        <>
          {/* Campaign setup form */}
          <EmailForm
            templates={templates}
            resumes={resumes}
            selectedTemplate={selectedTemplate}
            selectedResume={selectedResume}
            onTemplateChange={setSelectedTemplate}
            onResumeChange={setSelectedResume}
            onRecipientsReady={setRecipients}
            recipientCount={recipients.length}
            loading={loading}
            dailyEmailCount={dailyEmailCount}
          />

          {/* Start campaign button */}
          {recipients.length > 0 && selectedTemplate && (
            <div className="space-y-3">
              {!selectedResume && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mr-2" />
                  <span className="text-amber-800 text-sm">
                    No resume selected — emails will be sent without attachment
                  </span>
                </div>
              )}

              <button
                onClick={startCampaign}
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-semibold text-lg flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Starting Campaign...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Start Campaign ({recipients.length} recipients)
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
