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

      // Load existing draft
      await loadDraft();
    } catch (error) {
      toast.error("Error loading data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array since this function doesn't depend on any state

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-save draft when recipients change
  // Auto-save draft when recipients change
  const saveDraft = useCallback(async () => {
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
  }, [selectedTemplate, selectedResume, recipients]);

  // Auto-save when recipients or template changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveDraft();
    }, 1000); // Save 1 second after changes stop

    return () => clearTimeout(timeoutId);
  }, [saveDraft]);

  // Load existing draft on page load
  const loadDraft = async () => {
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

        // Restore the draft state
        setCampaignId(campaignId);
        setSelectedTemplate(templateId || "");
        setSelectedResume(resumeId || "");
        setRecipients(recipients || []);

        console.log("Draft loaded:", campaignName || "Unnamed campaign");
        toast.success("Previous draft restored!");
      }
    } catch (error) {
      console.error("Error loading draft:", error);
    }
  };

  const handleAddRecipient = (recipient) => {
    setRecipients([...recipients, { ...recipient, id: Date.now() }]);
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

        // Start polling for status updates
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

  // Start polling for campaign status updates
  const startStatusPolling = () => {
    if (statusPolling) {
      clearInterval(statusPolling);
    }

    const pollInterval = setInterval(async () => {
      if (!campaignId) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          clearInterval(pollInterval);
          return;
        }

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

          // Update campaign status
          setCampaignStatus(campaign.status);
          setCampaignProgress(campaign.progress);
          setCurrentlySending(campaign.currentlySending);

          // Update recipient lists
          setSentRecipients(campaign.recipients.sent || []);
          setFailedRecipients(campaign.recipients.failed || []);
          setRecipients(campaign.recipients.pending || []);

          // Check if campaign is complete
          if (
            campaign.status === "completed" ||
            campaign.status === "cancelled"
          ) {
            clearInterval(pollInterval);
            setSending(false);
            setCurrentlySending(null);

            if (campaign.status === "completed") {
              toast.success(
                `Campaign completed: ${campaign.progress.sent} sent, ${campaign.progress.failed} failed`
              );
            } else {
              toast.info("Campaign was cancelled");
            }
          }
        }
      } catch (error) {
        console.error("Status polling error:", error);
      }
    }, 2000); // Poll every 2 seconds

    setStatusPolling(pollInterval);
  };

  // Stop status polling
  const stopStatusPolling = () => {
    if (statusPolling) {
      clearInterval(statusPolling);
      setStatusPolling(null);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopStatusPolling();
  }, []);

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

  const handleRemoveRecipient = (id) => {
    if (id.toString().startsWith("failed-")) {
      // Remove from failed list
      const actualId = id.replace("failed-", "");
      setFailedRecipients((prev) =>
        prev.filter((r) => r.id.toString() !== actualId)
      );
    } else {
      // Remove from main recipients list
      setRecipients((prev) => prev.filter((r) => r.id !== id));
    }
  };

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
          />
        </div>
      </div>
    </div>
  );
}
