// src/app/email/page.js - PHASE 3 UPDATES
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import EmailForm from "@/components/Email/EmailForm";
import RecipientList from "@/components/Email/RecipientList";
import { supabase } from "@/lib/supabase";
import { AlertCircle, Settings } from "lucide-react";
import Button from "@/components/UI/Button";
import toast from "react-hot-toast";

export default function EmailPage() {
  const [templates, setTemplates] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedResume, setSelectedResume] = useState("");
  const [loading, setLoading] = useState(true);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [dailyEmailCount, setDailyEmailCount] = useState(0);

  // Campaign management
  const [campaignId, setCampaignId] = useState(null);
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [campaignProgress, setCampaignProgress] = useState({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
  });

  // Recipients by status
  const [currentlySending, setCurrentlySending] = useState(null);
  const [sentRecipients, setSentRecipients] = useState([]);
  const [failedRecipients, setFailedRecipients] = useState([]);

  // User control states
  const [sending, setSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);
  const [currentDelayInfo, setCurrentDelayInfo] = useState(null);
  const [forceStop, setForceStop] = useState(false);

  // Real-time updates
  const [statusPolling, setStatusPolling] = useState(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // NEW: Background sending state
  const [backgroundCampaignId, setBackgroundCampaignId] = useState(null);
  const [showBackgroundStatus, setShowBackgroundStatus] = useState(false);

  // Load existing draft on page load - FIXED VERSION
  const loadDraft = useCallback(async () => {
    if (draftLoaded) {
      console.log("Draft already loaded, skipping");
      return;
    }

    setDraftLoaded(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch("/api/campaigns/draft", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (data.success && data.draft) {
        const { campaignId, campaignName, templateId, resumeId, recipients } =
          data.draft;

        console.log("📥 Loading draft from database:", {
          campaignName: campaignName || "Unnamed campaign",
          recipientCount: recipients?.length || 0,
        });

        setCampaignId(campaignId);
        setSelectedTemplate(templateId || "");
        setSelectedResume(resumeId || "");
        setRecipients(recipients || []);

        console.log("Draft loaded:", campaignName || "Unnamed campaign");
        toast.success("Previous draft restored!");

        if (campaignId) {
          checkCampaignStatus(campaignId, session);
        }
      } else {
        console.log("📭 No draft found in database");
      }
    } catch (error) {
      console.error("Error loading draft:", error);
      setDraftLoaded(false);
    }
  }, [draftLoaded]);

  const fetchData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Check email configuration
      const emailResponse = await fetch("/api/email/settings", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        setEmailConfigured(emailData.data?.email_configured || false);
      }

      // Fetch daily email count
      const dailyCountResponse = await fetch("/api/campaigns/daily-count", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
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

      await loadDraft();
    } catch (error) {
      toast.error("Error loading data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [loadDraft]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-save draft when recipients change
  const saveDraft = useCallback(async () => {
    if (
      sending ||
      campaignStatus === "sending" ||
      campaignStatus === "paused"
    ) {
      console.log("Skipping auto-save: campaign is active");
      return;
    }

    if (!selectedTemplate || recipients.length === 0) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch("/api/campaigns/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          templateId: selectedTemplate,
          resumeId: selectedResume,
          recipients: recipients,
          campaignName: null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCampaignId(data.campaignId);
        console.log("Draft saved automatically");
      }
    } catch (error) {
      console.error("Error saving draft:", error);
    }
  }, [selectedTemplate, selectedResume, recipients, sending, campaignStatus]);

  const saveDraftWithRecipients = useCallback(
    async (recipientsList) => {
      if (
        sending ||
        campaignStatus === "sending" ||
        campaignStatus === "paused"
      ) {
        console.log("Skipping save: campaign is active");
        return;
      }

      if (!selectedTemplate || recipientsList.length === 0) {
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

        const response = await fetch("/api/campaigns/draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            templateId: selectedTemplate,
            resumeId: selectedResume,
            recipients: recipientsList,
            campaignName: null,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setCampaignId(data.campaignId);
          console.log("Draft saved immediately");
        }
      } catch (error) {
        console.error("Error saving draft immediately:", error);
      }
    },
    [selectedTemplate, selectedResume, sending, campaignStatus]
  );

  // Function to check campaign status and resume polling if needed
  const checkCampaignStatus = async (campaignId, session) => {
    try {
      const response = await fetch(
        `/api/campaigns/status?campaignId=${campaignId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        const { campaign } = data;

        setCampaignStatus(campaign.status);
        setCampaignProgress(campaign.progress);
        setCurrentlySending(campaign.currentlySending);
        setSentRecipients(campaign.recipients.sent || []);
        setFailedRecipients(campaign.recipients.failed || []);
        setRecipients(campaign.recipients.pending || []);

        if (campaign.status === "sending" || campaign.status === "paused") {
          setSending(true);
          setIsPaused(campaign.status === "paused");
          startStatusPolling();

          if (campaign.status === "sending") {
            toast.info("Resuming campaign monitoring...");
          } else {
            toast.info("Campaign is paused - you can resume it");
          }
        } else if (campaign.status === "completed") {
          toast.success(
            `Campaign completed: ${campaign.progress.sent} sent, ${campaign.progress.failed} failed`
          );
        } else if (campaign.status === "cancelled") {
          toast.info("Campaign was previously cancelled");
        }
      }
    } catch (error) {
      console.error("Error checking campaign status:", error);
    }
  };

  const handleBulkAdd = async (newRecipients) => {
    console.log(`🏠 Page: Bulk adding ${newRecipients.length} recipients`);

    const updatedRecipients = [...recipients, ...newRecipients];
    setRecipients(updatedRecipients);

    await saveDraftWithRecipients(updatedRecipients);

    console.log(
      `✅ Bulk add complete: ${updatedRecipients.length} total recipients`
    );
  };

  const handleAddRecipient = async (recipient) => {
    const newRecipient = { ...recipient, id: Date.now() };
    const updatedRecipients = [...recipients, newRecipient];

    setRecipients(updatedRecipients);
    await saveDraftWithRecipients(updatedRecipients);
  };

  // NEW: Handle method selection (immediate vs background)
  const handleSendMethodSelect = async (method) => {
    if (method === "realtime") {
      // Existing immediate sending logic
      handleSendEmails();
    } else if (method === "background") {
      // NEW: Background sending logic
      handleSendInBackground();
    }
  };

  // NEW: Background sending handler
  const handleSendInBackground = async () => {
    if (!selectedTemplate || recipients.length === 0) {
      toast.error("Please fill all required fields");
      return;
    }

    if (recipients.length > 500) {
      toast.error("Maximum 500 recipients allowed for background sending");
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

      // Save draft first (if not already saved)
      if (!campaignId) {
        await saveDraft();
      }

      if (!campaignId) {
        toast.error("Failed to create campaign");
        return;
      }

      // Start the background campaign
      const response = await fetch("/api/campaigns/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaignId: campaignId,
          sendMethod: "background", // NEW: Specify background method
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Campaign queued for background processing!");

        // Set background campaign state
        setBackgroundCampaignId(campaignId);
        setShowBackgroundStatus(true);
        setCampaignStatus("sending");

        // Clear recipients since they're now being processed
        setRecipients([]);

        // Start light polling for background status
        startBackgroundStatusPolling();

        // Show informational message
        toast.info(
          "Campaign is running in background. You can close this page safely.",
          {
            duration: 5000,
          }
        );
      } else {
        toast.error(data.error || "Failed to start background campaign");
      }
    } catch (error) {
      console.error("Background campaign error:", error);
      toast.error("Error starting background campaign");
    }
  };

  // Existing immediate sending handler
  const handleSendEmails = async () => {
    if (!selectedTemplate || recipients.length === 0) {
      toast.error("Please fill all required fields");
      return;
    }

    if (recipients.length > 20) {
      toast.error("Use background sending for campaigns over 20 recipients");
      return;
    }

    setSending(true);
    setShouldStop(false);
    setIsPaused(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Please login again");
        return;
      }

      if (!campaignId) {
        await saveDraft();
      }

      if (!campaignId) {
        toast.error("Failed to create campaign");
        return;
      }

      const response = await fetch("/api/campaigns/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaignId: campaignId,
          sendMethod: "immediate", // NEW: Specify immediate method
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Campaign started successfully!");
        setCampaignStatus("sending");
        startStatusPolling();
      } else {
        toast.error(data.error || "Failed to start campaign");
        setSending(false);
      }
    } catch (error) {
      console.error("Start campaign error:", error);
      toast.error("Error starting campaign");
      setSending(false);
    }
  };

  // NEW: Background status polling (lighter than real-time)
  const startBackgroundStatusPolling = useCallback(() => {
    if (statusPolling) {
      clearInterval(statusPolling);
    }

    const pollInterval = setInterval(async () => {
      if (!backgroundCampaignId) return;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

        const response = await fetch(
          `/api/campaigns/status?campaignId=${backgroundCampaignId}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const data = await response.json();

        if (data.success) {
          const { campaign } = data;

          setCampaignProgress(campaign.progress);
          setSentRecipients(campaign.recipients.sent || []);
          setFailedRecipients(campaign.recipients.failed || []);

          // Check if completed
          if (
            campaign.status === "completed" ||
            campaign.status === "cancelled"
          ) {
            setShowBackgroundStatus(false);
            setBackgroundCampaignId(null);
            clearInterval(pollInterval);
            setStatusPolling(null);

            if (campaign.status === "completed") {
              toast.success(
                `✅ Background campaign completed: ${campaign.progress.sent} sent, ${campaign.progress.failed} failed`
              );
            }
          }
        }
      } catch (error) {
        console.error("Background status polling error:", error);
      }
    }, 10000); // Poll every 10 seconds for background campaigns

    setStatusPolling(pollInterval);
  }, [backgroundCampaignId]);

  const refreshCampaignStatus = useCallback(async () => {
    if (!campaignId) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `/api/campaigns/status?campaignId=${campaignId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        const { campaign } = data;

        if (
          campaign.status === "completed" ||
          campaign.status === "cancelled"
        ) {
          console.log("🧹 Campaign completed - cleaning slate");

          if (statusPolling) {
            clearInterval(statusPolling);
            setStatusPolling(null);
          }

          setSending(false);
          setCurrentlySending(null);
          setCurrentDelayInfo(null);
          setSentRecipients([]);
          setFailedRecipients([]);
          setRecipients([]);
          setCampaignId(null);
          setCampaignStatus(null);
          setCampaignProgress({ sent: 0, failed: 0, total: 0 });

          if (campaign.status === "completed") {
            toast.success(
              `✅ Campaign completed: ${campaign.progress.sent} sent, ${campaign.progress.failed} failed`
            );
          } else {
            toast.info("Campaign was cancelled");
          }

          return;
        }

        setCampaignStatus(campaign.status);
        setCampaignProgress(campaign.progress);
        setSentRecipients(campaign.recipients.sent || []);
        setFailedRecipients(campaign.recipients.failed || []);
        if (campaign.status === "sending" || campaign.status === "paused") {
          setRecipients(campaign.recipients.pending || []);
        }
      }
    } catch (error) {
      console.error("Status refresh error:", error);
    }
  }, [campaignId, statusPolling]);

  // Start polling for campaign status updates (for immediate sending)
  const startStatusPolling = useCallback(() => {
    if (statusPolling) {
      clearInterval(statusPolling);
    }

    const pollInterval = setInterval(async () => {
      await refreshCampaignStatus();
    }, 3000); // Poll every 3 seconds for immediate campaigns

    setStatusPolling(pollInterval);
  }, [refreshCampaignStatus]);

  const stopStatusPolling = useCallback(() => {
    if (statusPolling) {
      clearInterval(statusPolling);
      setStatusPolling(null);
    }
  }, [statusPolling]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (
          campaignId &&
          (campaignStatus === "sending" || campaignStatus === "paused")
        ) {
          console.log("Tab visible again, checking campaign status...");

          const recheckStatus = async () => {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session) {
              await checkCampaignStatus(campaignId, session);
            }
          };

          recheckStatus();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [campaignId, campaignStatus]);

  useEffect(() => {
    return () => stopStatusPolling();
  }, [stopStatusPolling]);

  const handlePauseSending = async () => {
    setIsPaused(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/campaigns/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaignId: campaignId,
          action: "pause",
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.info("Campaign paused");
        setCampaignStatus("paused");
      } else {
        setIsPaused(false);
        toast.error("Failed to pause campaign");
      }
    } catch (error) {
      setIsPaused(false);
      toast.error("Error pausing campaign");
    }
  };

  const handleResumeSending = async () => {
    setIsPaused(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/campaigns/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaignId: campaignId,
          action: "resume",
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.info("Campaign resumed");
        setCampaignStatus("sending");
      } else {
        setIsPaused(true);
        toast.error("Failed to resume campaign");
      }
    } catch (error) {
      setIsPaused(true);
      toast.error("Error resuming campaign");
    }
  };

  const handleStopSending = async () => {
    setShouldStop(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/campaigns/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaignId: campaignId,
          action: "cancel",
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.info("Campaign cancelled");
        setCampaignStatus("cancelled");
        setSending(false);
        stopStatusPolling();
      } else {
        setShouldStop(false);
        toast.error("Failed to cancel campaign");
      }
    } catch (error) {
      setShouldStop(false);
      toast.error("Error cancelling campaign");
    }
  };

  const handleRetryFailed = async (failedList) => {
    if (!failedList || failedList.length === 0) return;

    setRecipients((prev) => [...prev, ...failedList]);

    setFailedRecipients((prev) =>
      prev.filter(
        (failed) => !failedList.find((retry) => retry.id === failed.id)
      )
    );

    setCampaignProgress((prev) => ({
      ...prev,
      total: prev.total,
    }));

    toast.info(`${failedList.length} recipients moved back to queue`);
  };

  const handleRemoveRecipient = useCallback(
    async (id) => {
      if (
        sending ||
        campaignStatus === "sending" ||
        campaignStatus === "paused"
      ) {
        toast.error("Cannot remove recipients during active campaign");
        return;
      }

      if (id.toString().startsWith("failed-")) {
        const actualId = id.replace("failed-", "");
        setFailedRecipients((prev) =>
          prev.filter((r) => r.id.toString() !== actualId)
        );
      } else {
        const updatedRecipients = recipients.filter((r) => r.id !== id);
        setRecipients(updatedRecipients);

        console.log(
          `🗑️ Removing recipient ${id}, saving ${updatedRecipients.length} recipients to database`
        );

        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) return;

          const response = await fetch("/api/campaigns/draft", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              templateId: selectedTemplate,
              resumeId: selectedResume,
              recipients: updatedRecipients,
              campaignName: null,
            }),
          });

          const data = await response.json();
          if (data.success) {
            console.log("✅ Recipients deletion saved to database");
            toast.success("Recipient removed");
          } else {
            console.error("❌ Failed to save deletion to database");
            toast.error("Failed to save changes");
          }
        } catch (error) {
          console.error("❌ Error saving deletion:", error);
          toast.error("Error saving changes");
        }
      }
    },
    [recipients, sending, campaignStatus, selectedTemplate, selectedResume]
  );

  if (!emailConfigured) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Send Email Campaign
        </h1>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">
            Email Configuration Required
          </h2>
          <p className="text-yellow-700 mb-4">
            Before you can send emails, you need to configure your email
            settings. This ensures emails are sent from your own email account
            securely.
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
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Send Email Campaign
      </h1>

      {/* NEW: Background Campaign Status Bar */}
      {showBackgroundStatus && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="animate-spin mr-3">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-blue-900">
                  Background Campaign Running
                </h3>
                <p className="text-sm text-blue-700">
                  {campaignProgress.sent} sent, {campaignProgress.failed} failed
                  {campaignProgress.total > 0 && (
                    <span> of {campaignProgress.total} total</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowBackgroundStatus(false)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Hide
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <EmailForm
            templates={templates}
            resumes={resumes}
            selectedTemplate={selectedTemplate}
            selectedResume={selectedResume}
            onTemplateChange={setSelectedTemplate}
            onResumeChange={setSelectedResume}
            onAddRecipient={handleAddRecipient}
            loading={loading}
            dailyEmailCount={dailyEmailCount}
            onBulkAdd={handleBulkAdd}
          />
        </div>

        <div>
          <RecipientList
            recipients={recipients}
            onRemove={handleRemoveRecipient}
            onSend={handleSendEmails}
            selectedResume={selectedResume}
            sending={sending}
            currentlySending={currentlySending}
            sentRecipients={sentRecipients}
            failedRecipients={failedRecipients}
            campaignProgress={campaignProgress}
            onRetryFailed={handleRetryFailed}
            onPauseSending={handlePauseSending}
            onResumeSending={handleResumeSending}
            isPaused={isPaused}
            currentDelayInfo={currentDelayInfo}
            campaignStatus={campaignStatus}
            onStopSending={handleStopSending}
            shouldStop={shouldStop}
            forceStop={forceStop}
            // NEW: Updated props for method selection
            onSendMethodSelect={handleSendMethodSelect}
            showMethodSelection={
              recipients.length > 0 && !sending && !showBackgroundStatus
            }
          />
        </div>
      </div>
    </div>
  );
}
