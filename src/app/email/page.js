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
    if (!selectedTemplate || !selectedResume || recipients.length === 0) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          resumeId: selectedResume,
          recipients,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Successfully sent ${data.sent} emails!`);
        setRecipients([]);
      } else {
        toast.error("Error sending emails");
      }
    } catch (error) {
      toast.error("Error sending emails");
      console.error(error);
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
          />
        </div>
      </div>
    </div>
  );
}
