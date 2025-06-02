"use client";
import { useState, useEffect } from "react";
import EmailForm from "@/components/Email/EmailForm";
import RecipientList from "@/components/Email/RecipientList";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function EmailPage() {
  const [templates, setTemplates] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedResume, setSelectedResume] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    fetchData();
  }, []);
  const fetchData = async () => {
    try {
      // Fetch templates
      const { data: templatesData, error: templatesError } = await supabase
        .from("templates")
        .select("*")
        .eq("type", "email")
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
  const handleRemoveRecipient = (id) => {
    setRecipients(recipients.filter((r) => r.id !== id));
  };
  const handleSendEmails = async () => {
    if (!selectedTemplate || recipients.length === 0) {
      toast.error("Please fill all required fields");
      return;
    }

    setSending(true);

    try {
      // Get the current session for auth
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Please login again");
        return;
      }

      console.log("Sending email request...");

      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          templateId: selectedTemplate,
          resumeId: selectedResume,
          recipients,
        }),
      });

      const data = await response.json();
      console.log("Email response:", data);

      if (data.success) {
        toast.success(`Successfully sent ${data.sent} emails!`);
        setRecipients([]);
        setSelectedTemplate("");
        setSelectedResume("");
      } else {
        toast.error(data.error || "Error sending emails");
      }
    } catch (error) {
      console.error("Send email error:", error);
      toast.error("Error sending emails");
    } finally {
      setSending(false); // ADD THIS LINE
    }
  };
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
          />
        </div>
      </div>
    </div>
  );
}
