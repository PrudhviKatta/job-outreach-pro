// Clean EmailPage.js - Phase 2: Simple campaign management
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import CleanEmailForm from "@/components/Email/EmailForm";
import CampaignProgress from "@/components/Email/CampaignProgress";
import { supabase } from "@/lib/supabase";
import { AlertCircle, Settings, CheckCircle } from "lucide-react";
import Button from "@/components/UI/Button";
import toast from "react-hot-toast";

export default function EmailPage() {
  // Core state
  const [templates, setTemplates] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedResume, setSelectedResume] = useState("");
  const [loading, setLoading] = useState(true);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [dailyEmailCount, setDailyEmailCount] = useState(0);

  // Campaign state (simplified)
  const [campaignId, setCampaignId] = useState(null);
  const [campaignStatus, setCampaignStatus] = useState(null); // null, 'sending', 'completed', 'failed'
  const [campaignProgress, setCampaignProgress] = useState({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
  });

  // Single status polling
  const [statusInterval, setStatusInterval] = useState(null);
  // Add missing shouldStop state
  const [shouldStop, setShouldStop] = useState(false);

  useEffect(() => {
    fetchInitialData();
    return () => {
      if (statusInterval) {
        console.log("🧹 Clearing interval on component unmount");
        clearInterval(statusInterval);
      }
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Check email configuration
      const emailResponse = await fetch("/api/email/settings", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        setEmailConfigured(emailData.data?.email_configured || false);
      }

      // Fetch daily email count
      const dailyCountResponse = await fetch("/api/campaigns/daily-count", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (dailyCountResponse.ok) {
        const dailyData = await dailyCountResponse.json();
        setDailyEmailCount(dailyData.count || 0);
      }

      // Fetch templates
      const { data: templatesData, error: templatesError } = await supabase
        .from("templates")
        .select("*")
        .eq("type", "email")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (templatesError) throw templatesError;
      setTemplates(templatesData || []);

      // Fetch resumes
      const { data: resumesData, error: resumesError } = await supabase
        .from("resumes")
        .select("*")
        .order("created_at", { ascending: false });

      if (resumesError) throw resumesError;
      setResumes(resumesData || []);

      // Check for active campaigns
      await checkActiveCampaign(session);
    } catch (error) {
      toast.error("Error loading data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const checkActiveCampaign = async (session) => {
    try {
      console.log("🔍 Checking for active campaigns...");

      const { data: activeCampaigns } = await supabase
        .from("email_campaigns")
        .select("id, status, total_recipients, sent_count, failed_count")
        .eq("status", "sending")
        .order("created_at", { ascending: false })
        .limit(1);

      console.log("📋 Found active campaigns:", activeCampaigns);

      if (activeCampaigns && activeCampaigns.length > 0) {
        const campaign = activeCampaigns[0];
        console.log("✅ Resuming monitoring for campaign:", campaign.id);

        setCampaignId(campaign.id);
        setCampaignStatus("sending");
        setCampaignProgress({
          total: campaign.total_recipients,
          sent: campaign.sent_count,
          failed: campaign.failed_count,
          pending:
            campaign.total_recipients -
            campaign.sent_count -
            campaign.failed_count,
        });
        startStatusPolling(campaign.id, session);
        toast.success("Found active campaign - monitoring progress");
      } else {
        console.log("ℹ️ No active campaigns found");
      }
    } catch (error) {
      console.error("Error checking active campaigns:", error);
    }
  };

  const handleRecipientsReady = (newRecipients) => {
    console.log(`📥 Received ${newRecipients.length} recipients`);
    setRecipients(newRecipients);
  };

  const handleStartCampaign = async () => {
    if (!selectedTemplate || recipients.length === 0) {
      toast.error("Please select a template and add recipients");
      return;
    }

    if (recipients.length > 500) {
      toast.error("Maximum 500 recipients allowed");
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Please login again");
        return;
      }

      console.log(`🚀 Starting campaign with ${recipients.length} recipients`);

      // Use the existing /api/campaigns/start endpoint (not start-clean)
      const response = await fetch("/api/campaigns/start-clean", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          templateId: selectedTemplate,
          resumeId: selectedResume || null,
          recipients: recipients,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Campaign started successfully!");

        setCampaignId(data.campaignId);
        setCampaignStatus("sending");
        setCampaignProgress({
          total: recipients.length,
          sent: 0,
          failed: 0,
          pending: recipients.length,
        });

        // Clear recipients from UI (they're now being processed)
        setRecipients([]);

        // Start monitoring progress
        startStatusPolling(data.campaignId, session);
      } else {
        toast.error(data.error || "Failed to start campaign");
      }
    } catch (error) {
      console.error("Start campaign error:", error);
      toast.error("Error starting campaign");
    }
  };

  const startStatusPolling = (campaignId, session) => {
    console.log("🔄 Starting status polling for campaign:", campaignId);

    // Clear any existing interval first
    if (statusInterval) {
      console.log("🧹 Clearing existing polling interval");
      clearInterval(statusInterval);
    }

    const interval = setInterval(async () => {
      console.log("📊 Status polling tick for campaign:", campaignId);
      try {
        const response = await fetch(
          `/api/campaigns/status?campaignId=${campaignId}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );

        if (!response.ok) {
          console.error("❌ Status polling response not ok:", response.status);
          return;
        }

        const data = await response.json();

        if (data.success) {
          const { campaign } = data;

          console.log("📋 Campaign status from API:", campaign.status);

          setCampaignProgress(campaign.progress);

          // Handle all terminal states and STOP POLLING
          if (
            ["completed", "failed", "stopped", "cancelled"].includes(
              campaign.status
            )
          ) {
            console.log(`🛑 Campaign ${campaign.status} - stopping polling`);
            setCampaignStatus(campaign.status);
            clearInterval(interval);
            setStatusInterval(null);

            // Show appropriate message
            if (campaign.status === "completed") {
              toast.success(
                `✅ Campaign completed! ${campaign.progress.sent} sent, ${campaign.progress.failed} failed`
              );
            } else if (campaign.status === "failed") {
              toast.error("❌ Campaign failed");
            } else if (campaign.status === "stopped") {
              toast.success("Campaign stopped");
            } else if (campaign.status === "cancelled") {
              toast.info("Campaign cancelled");
            }
          }
        } else {
          console.error("❌ Status polling API error:", data.error);
        }
      } catch (error) {
        console.error("❌ Status polling network error:", error);
      }
    }, 5000); // Poll every 5 seconds

    setStatusInterval(interval);
    console.log("✅ Status polling started");
  };

  // FIXED: Add the missing handleStopCampaign function
  const handleStopCampaign = async () => {
    console.log("🛑 === STOP CAMPAIGN INITIATED ===");
    console.log("🛑 Campaign ID to stop:", campaignId);
    console.log("🛑 Current Status:", campaignStatus);
    console.log("🛑 Status Interval Active:", !!statusInterval);

    if (!campaignId) {
      toast.error("No active campaign to stop");
      console.error("❌ No campaignId found in state");
      return;
    }

    setShouldStop(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Please login again");
        setShouldStop(false);
        return;
      }

      console.log("📡 Sending POST to /api/campaigns/stop");
      console.log("📡 Request body:", { campaignId });

      const response = await fetch("/api/campaigns/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaignId: campaignId,
        }),
      });

      console.log("📡 Response status:", response.status);

      const data = await response.json();
      console.log("📡 Response data:", data);

      if (data.success) {
        console.log("✅ Stop request successful");
        toast.success("Campaign stopped successfully");

        // CRITICAL: Clear polling IMMEDIATELY
        if (statusInterval) {
          console.log("🧹 Clearing status polling interval");
          clearInterval(statusInterval);
          setStatusInterval(null);
        } else {
          console.log("ℹ️ No status polling was active");
        }

        // Reset ALL campaign-related state
        console.log("🧹 Resetting all campaign state");
        setCampaignStatus("stopped");
        setCampaignId(null);
        setCampaignProgress({ sent: 0, failed: 0, total: 0, pending: 0 });
        setShouldStop(false);

        console.log("✅ Campaign state reset successfully");
      } else {
        setShouldStop(false);
        toast.error(data.error || "Failed to stop campaign");
        console.error("❌ Stop request failed:", data.error);
      }
    } catch (error) {
      setShouldStop(false);
      toast.error("Error stopping campaign");
      console.error("❌ Stop request error:", error);
    }

    console.log("🛑 === STOP CAMPAIGN COMPLETED ===");
  };

  const resetCampaign = () => {
    console.log("🔄 Resetting campaign state");
    setCampaignId(null);
    setCampaignStatus(null);
    setCampaignProgress({ total: 0, sent: 0, failed: 0, pending: 0 });
    setRecipients([]);
    setShouldStop(false);
    if (statusInterval) {
      console.log("🧹 Clearing interval during reset");
      clearInterval(statusInterval);
      setStatusInterval(null);
    }
  };

  // Check if campaign can be started
  const canStartCampaign =
    selectedTemplate && recipients.length > 0 && !campaignStatus;

  if (!emailConfigured) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Email Campaign
        </h1>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">
            Email Configuration Required
          </h2>
          <p className="text-yellow-700 mb-4">
            Before you can send emails, you need to configure your email
            settings.
          </p>
          <Link href="/settings">
            <Button className="flex items-center mx-auto">
              <Settings className="w-4 h-4 mr-2" />
              Configure Email Settings
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Email Campaign</h1>

      {/* Debug Panel - Only in development */}
      {process.env.NODE_ENV === "development" && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-bold text-yellow-800 mb-2">🐛 Debug Info:</h3>
          <div className="grid grid-cols-2 gap-4 text-sm text-yellow-700">
            <div>
              <strong>Campaign ID:</strong> {campaignId || "null"}
            </div>
            <div>
              <strong>Campaign Status:</strong> {campaignStatus || "null"}
            </div>
            <div>
              <strong>Status Interval:</strong>{" "}
              {statusInterval ? "ACTIVE" : "INACTIVE"}
            </div>
            <div>
              <strong>Should Stop:</strong> {shouldStop.toString()}
            </div>
            <div>
              <strong>Recipients:</strong> {recipients.length}
            </div>
            <div>
              <strong>Progress:</strong> {JSON.stringify(campaignProgress)}
            </div>
          </div>

          <div className="mt-3 flex space-x-2">
            <button
              onClick={() => {
                console.log("🔍 Current State:", {
                  campaignId,
                  campaignStatus,
                  statusInterval: !!statusInterval,
                  shouldStop,
                  recipients: recipients.length,
                  campaignProgress,
                });
              }}
              className="px-3 py-1 bg-yellow-200 text-yellow-800 text-xs rounded hover:bg-yellow-300"
            >
              Log State
            </button>

            {statusInterval && (
              <button
                onClick={() => {
                  console.log("🛑 Force clearing interval");
                  clearInterval(statusInterval);
                  setStatusInterval(null);
                  toast.info("Polling cleared");
                }}
                className="px-3 py-1 bg-red-200 text-red-800 text-xs rounded hover:bg-red-300"
              >
                Force Clear Polling
              </button>
            )}

            <button
              onClick={resetCampaign}
              className="px-3 py-1 bg-blue-200 text-blue-800 text-xs rounded hover:bg-blue-300"
            >
              Reset State
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Campaign Setup */}
        <div>
          <CleanEmailForm
            templates={templates}
            resumes={resumes}
            selectedTemplate={selectedTemplate}
            selectedResume={selectedResume}
            onTemplateChange={setSelectedTemplate}
            onResumeChange={setSelectedResume}
            onRecipientsReady={handleRecipientsReady}
            recipientCount={recipients.length}
            loading={loading}
            dailyEmailCount={dailyEmailCount}
          />
        </div>

        {/* Campaign Status */}
        <div>
          {campaignStatus ? (
            <CampaignProgress
              status={campaignStatus}
              progress={campaignProgress}
              onStop={handleStopCampaign}
              onReset={resetCampaign}
              shouldStop={shouldStop}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Start Campaign</h2>

              {recipients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Add recipients to start your campaign</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Campaign Summary */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-900 mb-2">
                      Campaign Ready
                    </h3>
                    <div className="text-sm text-blue-700 space-y-1">
                      <div>
                        📧 Template:{" "}
                        {templates.find((t) => t.id === selectedTemplate)?.name}
                      </div>
                      <div>👥 Recipients: {recipients.length}</div>
                      <div>
                        📎 Resume:{" "}
                        {selectedResume
                          ? resumes.find((r) => r.id === selectedResume)
                              ?.display_name
                          : "No attachment"}
                      </div>
                    </div>
                  </div>

                  {/* Resume Warning */}
                  {!selectedResume && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-center text-amber-800">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        <span className="text-sm">
                          No resume selected - emails will be sent without
                          attachment
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Start Button */}
                  <Button
                    onClick={handleStartCampaign}
                    disabled={!canStartCampaign}
                    className="w-full flex items-center justify-center"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Start Campaign
                  </Button>

                  <p className="text-xs text-gray-500 text-center">
                    Campaign will run in the background. You can close this page
                    safely.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
