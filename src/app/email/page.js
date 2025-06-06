// src/app/email/page.js
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

  // Load existing draft on page load - FIXED VERSION
  const loadDraft = useCallback(async () => {
    // ✅ PREVENT MULTIPLE CALLS
    if (draftLoaded) {
      console.log("Draft already loaded, skipping");
      return;
    }

    // ✅ SET FLAG IMMEDIATELY to prevent race conditions
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
          recipients:
            recipients?.map((r) => ({ id: r.id, email: r.email })) || [],
        });

        // Restore the draft state
        setCampaignId(campaignId);
        setSelectedTemplate(templateId || "");
        setSelectedResume(resumeId || "");
        setRecipients(recipients || []);

        console.log("Draft loaded:", campaignName || "Unnamed campaign");
        toast.success("Previous draft restored!");

        // Check if there's an active campaign after loading draft
        if (campaignId) {
          checkCampaignStatus(campaignId, session);
        }
      } else {
        console.log("📭 No draft found in database");
      }
    } catch (error) {
      console.error("Error loading draft:", error);
      // ✅ RESET FLAG ON ERROR so it can be retried
      setDraftLoaded(false);
    }
  }, [draftLoaded]); // ✅ Include draftLoaded in dependencies

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

      // ✅ ONLY LOAD DRAFT ONCE, AFTER OTHER DATA IS LOADED
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

  // ✅ IMPROVED Auto-save draft when recipients change
  const saveDraft = useCallback(async () => {
    // DON'T auto-save during active campaigns
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
          campaignName: null, // Auto-generate name
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

  // ✅ IMPROVED Helper function to save draft with specific recipients
  const saveDraftWithRecipients = useCallback(
    async (recipientsList) => {
      // DON'T save during active campaigns
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

  // NEW: Function to check campaign status and resume polling if needed
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

        // Update all states based on current campaign status
        setCampaignStatus(campaign.status);
        setCampaignProgress(campaign.progress);
        setCurrentlySending(campaign.currentlySending);
        setSentRecipients(campaign.recipients.sent || []);
        setFailedRecipients(campaign.recipients.failed || []);
        setRecipients(campaign.recipients.pending || []);

        // If campaign is actively running, start polling and email loop
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

  // Add this new function alongside handleAddRecipient
  const handleBulkAdd = async (newRecipients) => {
    console.log(`🏠 Page: Bulk adding ${newRecipients.length} recipients`);

    // Add all recipients to state at once
    const updatedRecipients = [...recipients, ...newRecipients];
    setRecipients(updatedRecipients);

    // Save to database ONCE with all recipients
    await saveDraftWithRecipients(updatedRecipients);

    console.log(
      `✅ Bulk add complete: ${updatedRecipients.length} total recipients`
    );
  };

  const handleAddRecipient = async (recipient) => {
    const newRecipient = { ...recipient, id: Date.now() };
    const updatedRecipients = [...recipients, newRecipient];

    // Update UI immediately
    setRecipients(updatedRecipients);

    // Save to database immediately
    await saveDraftWithRecipients(updatedRecipients);
  };

  const handleSendEmails = async () => {
    if (!selectedTemplate || recipients.length === 0) {
      toast.error("Please fill all required fields");
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

      // Save draft first (if not already saved)
      if (!campaignId) {
        await saveDraft();
      }

      if (!campaignId) {
        toast.error("Failed to create campaign");
        return;
      }

      // Start the campaign
      const response = await fetch("/api/campaigns/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaignId: campaignId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Campaign started successfully!");
        setCampaignStatus("sending");

        // Start the campaign loop and status polling
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

        // ✅ CLEAN SLATE: When campaign is completed
        if (
          campaign.status === "completed" ||
          campaign.status === "cancelled"
        ) {
          console.log("🧹 Campaign completed - cleaning slate");

          // Stop polling by clearing the interval directly
          if (statusPolling) {
            clearInterval(statusPolling);
            setStatusPolling(null);
          }

          // Reset all campaign states
          setSending(false);
          setCurrentlySending(null);
          setCurrentDelayInfo(null);
          setSentRecipients([]);
          setFailedRecipients([]);
          setRecipients([]); // This allows fresh start
          setCampaignId(null);
          setCampaignStatus(null);
          setCampaignProgress({ sent: 0, failed: 0, total: 0 });

          // Show completion message
          if (campaign.status === "completed") {
            toast.success(
              `✅ Campaign completed: ${campaign.progress.sent} sent, ${campaign.progress.failed} failed`
            );
          } else {
            toast.info("Campaign was cancelled");
          }

          return; // Don't update with old data
        }

        // Normal status updates for active campaigns
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

  // Start the campaign loop - sends emails with delays
  const startCampaignLoop = useCallback(async () => {
    if (!campaignId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      toast.error("Session expired, please login again");
      return;
    }

    const continueLoop = async () => {
      // Check if campaign should continue
      if (
        shouldStop ||
        campaignStatus === "paused" ||
        campaignStatus === "cancelled"
      ) {
        console.log("Campaign loop stopped:", { shouldStop, campaignStatus });
        return;
      }

      try {
        // Send next email
        const response = await fetch("/api/campaigns/continue", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ campaignId }),
        });

        const data = await response.json();

        if (data.success) {
          if (data.sentTo) {
            console.log(`Email sent to: ${data.sentTo.email}`);
            setCurrentlySending(data.sentTo);

            // Brief moment to show "currently sending"
            setTimeout(() => {
              setCurrentlySending(null);
            }, 1000);
          }

          // Refresh status to get updated recipient lists
          await refreshCampaignStatus();

          if (
            data.shouldContinue &&
            campaignStatus === "sending" &&
            !shouldStop
          ) {
            // Calculate delay
            const minDelay = 8000; // 8 seconds default
            const maxDelay = 20000; // 20 seconds default
            const randomDelay =
              Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

            setCurrentDelayInfo(
              `Waiting ${Math.round(
                randomDelay / 1000
              )} seconds before next email...`
            );

            // Wait before sending next email
            setTimeout(() => {
              setCurrentDelayInfo(null);
              continueLoop(); // Recursive call for next email
            }, randomDelay);
          } else {
            // Campaign finished or should stop
            setSending(false);
            setCurrentlySending(null);
            setCurrentDelayInfo(null);

            if (!data.shouldContinue) {
              toast.success("Campaign completed successfully!");
            }
          }
        } else {
          console.error("Continue campaign error:", data.error);
          setSending(false);
          setCurrentlySending(null);
          toast.error(data.error || "Error continuing campaign");
        }
      } catch (error) {
        console.error("Campaign loop error:", error);
        setSending(false);
        setCurrentlySending(null);
        toast.error("Error in campaign loop");
      }
    };

    // Start the loop
    continueLoop();
  }, [campaignId, shouldStop, campaignStatus, refreshCampaignStatus]);

  // Start polling for campaign status updates (lighter polling for UI updates)
  const startStatusPolling = useCallback(() => {
    // Clear any existing polling first
    if (statusPolling) {
      clearInterval(statusPolling);
    }

    const pollInterval = setInterval(async () => {
      await refreshCampaignStatus();
    }, 3000); // Poll every 3 seconds for status updates

    setStatusPolling(pollInterval);
  }, [campaignId]);

  // Stop status polling
  const stopStatusPolling = useCallback(() => {
    if (statusPolling) {
      clearInterval(statusPolling);
      setStatusPolling(null);
    }
  }, [statusPolling]);

  // NEW: Handle page visibility changes (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Tab became visible again
        if (
          campaignId &&
          (campaignStatus === "sending" || campaignStatus === "paused")
        ) {
          console.log("Tab visible again, checking campaign status...");

          // Re-check campaign status when tab becomes visible
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
      } else {
        // Tab became hidden - we can keep polling in background
        console.log("Tab hidden, polling continues in background");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [campaignId, campaignStatus]);

  // Cleanup polling on unmount
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

    // Move failed recipients back to main recipients list
    setRecipients((prev) => [...prev, ...failedList]);

    // Remove from failed list
    setFailedRecipients((prev) =>
      prev.filter(
        (failed) => !failedList.find((retry) => retry.id === failed.id)
      )
    );

    // Update progress total
    setCampaignProgress((prev) => ({
      ...prev,
      total: prev.total, // Keep the same total, just redistributing
    }));

    toast.info(`${failedList.length} recipients moved back to queue`);
  };

  const handleSendMethodSelect = (method) => {
    if (method === "realtime") {
      handleSendEmails();
    } else if (method === "background") {
      handleSendInBackground();
    }
  };

  const handleSendInBackground = async () => {
    // TODO: Implement background sending
    toast.info("Background sending will be implemented in the next step!");
    console.log(
      "Background sending selected with",
      recipients.length,
      "recipients"
    );
  };

  // ✅ FIXED Remove recipient function
  const handleRemoveRecipient = useCallback(
    async (id) => {
      // DON'T allow removal during active campaigns
      if (
        sending ||
        campaignStatus === "sending" ||
        campaignStatus === "paused"
      ) {
        toast.error("Cannot remove recipients during active campaign");
        return;
      }

      if (id.toString().startsWith("failed-")) {
        // Remove from failed list
        const actualId = id.replace("failed-", "");
        setFailedRecipients((prev) =>
          prev.filter((r) => r.id.toString() !== actualId)
        );
      } else {
        // Remove from main recipients list
        const updatedRecipients = recipients.filter((r) => r.id !== id);
        setRecipients(updatedRecipients);

        // 🔥 FORCE SAVE TO DATABASE IMMEDIATELY
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
            // New props for sending method selection
            onSendMethodSelect={handleSendMethodSelect}
            showMethodSelection={recipients.length > 0 && !sending}
          />
        </div>
      </div>
    </div>
  );
}
