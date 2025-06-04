// src/app/email/page.js
"use client";
import { useState, useEffect } from "react";
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
  const [sending, setSending] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  // Add these new state variables after the existing ones
  const [currentlySending, setCurrentlySending] = useState(null);
  const [sentRecipients, setSentRecipients] = useState([]);
  const [failedRecipients, setFailedRecipients] = useState([]);
  const [sendingProgress, setSendingProgress] = useState({
    sent: 0,
    failed: 0,
    total: 0,
  });
  const [isPaused, setIsPaused] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
    } catch (error) {
      toast.error("Error loading data");
      console.error(error);
    } finally {
      setLoading(false);
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
    setSendingProgress({ sent: 0, failed: 0, total: recipients.length });

    try {
      // Get the current session for auth
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Please login again");
        return;
      }

      console.log(
        "Starting email campaign for",
        recipients.length,
        "recipients"
      );

      // Send emails one by one
      for (let i = 0; i < recipients.length; i++) {
        // Check if user wants to stop
        if (shouldStop) {
          break;
        }

        // Wait if paused
        while (isPaused && !shouldStop) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (shouldStop) break;

        const recipient = recipients[i];
        setCurrentlySending(recipient);

        try {
          const response = await fetch("/api/email/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              templateId: selectedTemplate,
              resumeId: selectedResume,
              recipients: [recipient], // Send one at a time
            }),
          });

          const data = await response.json();
          console.log("Email response for", recipient.email, ":", data);

          if (data.success) {
            // Move to sent list
            setSentRecipients((prev) => [
              ...prev,
              {
                ...recipient,
                sentAt: new Date().toISOString(),
              },
            ]);

            // Remove from recipients list
            setRecipients((prev) => prev.filter((r) => r.id !== recipient.id));

            // Update progress
            setSendingProgress((prev) => ({
              ...prev,
              sent: prev.sent + 1,
            }));
          } else {
            // Move to failed list
            setFailedRecipients((prev) => [
              ...prev,
              {
                ...recipient,
                error: data.error || "Unknown error",
              },
            ]);

            // Remove from recipients list
            setRecipients((prev) => prev.filter((r) => r.id !== recipient.id));

            // Update progress
            setSendingProgress((prev) => ({
              ...prev,
              failed: prev.failed + 1,
            }));
          }
        } catch (error) {
          console.error("Send email error for", recipient.email, ":", error);

          // Move to failed list
          setFailedRecipients((prev) => [
            ...prev,
            {
              ...recipient,
              error: error.message,
            },
          ]);

          // Remove from recipients list
          setRecipients((prev) => prev.filter((r) => r.id !== recipient.id));

          // Update progress
          setSendingProgress((prev) => ({
            ...prev,
            failed: prev.failed + 1,
          }));
        }

        setCurrentlySending(null);

        // Add delay between emails (except for the last one)
        if (i < recipients.length - 1 && !shouldStop) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      // Show completion message
      const finalProgress = sendingProgress;
      if (finalProgress.sent > 0 || finalProgress.failed > 0) {
        if (finalProgress.failed === 0) {
          toast.success(`Successfully sent ${finalProgress.sent} emails!`);
        } else if (finalProgress.sent === 0) {
          toast.error(`All ${finalProgress.failed} emails failed to send`);
        } else {
          toast.success(
            `Campaign complete: ${finalProgress.sent} sent, ${finalProgress.failed} failed`
          );
        }
      }

      // Reset template and resume selection
      setSelectedTemplate("");
      setSelectedResume("");
    } catch (error) {
      console.error("Email campaign error:", error);
      toast.error("Error during email campaign");
    } finally {
      setSending(false);
      setCurrentlySending(null);
      setIsPaused(false);
      setShouldStop(false);
    }
  };

  const handlePauseSending = () => {
    setIsPaused(true);
    toast.info("Email sending paused");
  };

  const handleResumeSending = () => {
    setIsPaused(false);
    toast.info("Email sending resumed");
  };

  const handleStopSending = () => {
    setShouldStop(true);
    setIsPaused(false);
    toast.info("Stopping email campaign...");
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
    setSendingProgress((prev) => ({
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
            sendingProgress={sendingProgress}
            onRetryFailed={handleRetryFailed}
            onPauseSending={handlePauseSending}
            onResumeSending={handleResumeSending}
            isPaused={isPaused}
          />
        </div>
      </div>
    </div>
  );
}
