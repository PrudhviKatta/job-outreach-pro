// src/app/settings/page.js
"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Save,
  Upload,
  Trash2,
  Plus,
  Mail,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Shield,
} from "lucide-react";
import Button from "@/components/UI/Button";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    email_signature: "",
    default_resume_id: "",
    send_delay_min: 2,
    send_delay_max: 5,
    business_hours_only: true,
    follow_up_days: 3,
  });
  const [emailSettings, setEmailSettings] = useState({
    sender_email: "",
    email_configured: false,
    email_verified: false,
    email_verification_error: null,
    last_verified_at: null,
  });
  const [emailForm, setEmailForm] = useState({
    senderEmail: "",
    appPassword: "",
  });
  const [resumes, setResumes] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [emailLoading, setEmailLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [resumeLabel, setResumeLabel] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Fetch user settings
      const { data: settingsData } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (settingsData) {
        setSettings(settingsData);
      }

      // Fetch email settings
      const emailResponse = await fetch("/api/email/settings", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        if (emailData.success) {
          setEmailSettings(emailData.data);
          setEmailForm({
            senderEmail: emailData.data.sender_email || "",
            appPassword: "",
          });
        }
      }

      // Fetch resumes
      const { data: resumesData } = await supabase
        .from("resumes")
        .select("*")
        .order("created_at", { ascending: false });

      setResumes(resumesData || []);

      // Fetch custom fields
      const { data: fieldsData } = await supabase
        .from("custom_fields")
        .select("*")
        .order("order_index", { ascending: true });

      setCustomFields(fieldsData || []);
    } catch (error) {
      toast.error("Error loading settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("user_settings").upsert({
        user_id: user.id,
        ...settings,
      });

      if (error) throw error;
      toast.success("Settings saved!");
    } catch (error) {
      toast.error("Error saving settings");
    }
  };

  const handleSaveEmailSettings = async (testConnection = false) => {
    if (!emailForm.senderEmail || !emailForm.appPassword) {
      toast.error("Please fill in both email and app password");
      return;
    }

    if (testConnection) {
      setTestingConnection(true);
    } else {
      setEmailLoading(true);
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/email/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          senderEmail: emailForm.senderEmail,
          appPassword: emailForm.appPassword,
          testConnection,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setShowEmailForm(false);
        fetchSettings(); // Refresh settings
      } else {
        toast.error(data.error || "Failed to save email settings");
      }
    } catch (error) {
      toast.error("Error saving email settings");
    } finally {
      setEmailLoading(false);
      setTestingConnection(false);
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const fileName = `${user.id}/${Date.now()}_${file.name}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("resumes").getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase.from("resumes").insert({
        user_id: user.id,
        display_name: resumeLabel,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
      });

      if (dbError) throw dbError;

      toast.success("Resume uploaded!");
      fetchSettings();
      setResumeLabel("");
    } catch (error) {
      toast.error("Error uploading resume");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteResume = async (id) => {
    if (!confirm("Are you sure you want to delete this resume?")) return;

    try {
      const { error } = await supabase.from("resumes").delete().eq("id", id);

      if (error) throw error;
      toast.success("Resume deleted!");
      fetchSettings();
    } catch (error) {
      toast.error("Error deleting resume");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>
      {/* Email Configuration */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Mail className="w-5 h-5 mr-2" />
            Email Configuration
          </h2>
          {emailSettings.email_configured && (
            <div className="flex items-center text-sm">
              {emailSettings.email_verified ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Verified
                </div>
              ) : (
                <div className="flex items-center text-yellow-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Not Verified
                </div>
              )}
            </div>
          )}
        </div>

        {!emailSettings.email_configured ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" />
              <div>
                <h3 className="font-medium text-yellow-800">
                  Email Configuration Required
                </h3>
                <p className="text-yellow-700 text-sm mt-1">
                  You need to configure your email settings before sending any
                  emails. This ensures emails are sent from your own email
                  account.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  Current Email: {emailSettings.sender_email}
                </p>
                {emailSettings.last_verified_at && (
                  <p className="text-sm text-gray-600">
                    Last verified:{" "}
                    {new Date(
                      emailSettings.last_verified_at
                    ).toLocaleDateString()}
                  </p>
                )}
                {emailSettings.email_verification_error && (
                  <p className="text-sm text-red-600 mt-1">
                    Error: {emailSettings.email_verification_error}
                  </p>
                )}
              </div>
              <Button
                onClick={() => setShowEmailForm(true)}
                variant="outline"
                size="sm"
              >
                Update
              </Button>
            </div>
          </div>
        )}

        {(!emailSettings.email_configured || showEmailForm) && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 mr-2" />
                <div>
                  <h3 className="font-medium text-blue-800">
                    Security & Privacy
                  </h3>
                  <p className="text-blue-700 text-sm mt-1">
                    Your app password is encrypted using AES-256 encryption and
                    stored securely. We never store your actual password in
                    plain text.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sender Email Address *
              </label>
              <input
                type="email"
                value={emailForm.senderEmail}
                onChange={(e) =>
                  setEmailForm({ ...emailForm, senderEmail: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="your.email@gmail.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                App Password *
              </label>
              <input
                type="password"
                value={emailForm.appPassword}
                onChange={(e) =>
                  setEmailForm({ ...emailForm, appPassword: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Your 16-character app password"
                required
              />

              <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">
                  What is an App Password?
                </h4>
                <p className="text-sm text-gray-700 mb-3">
                  An app password is a secure way to let third-party apps access
                  your email without sharing your main password. It&apos;s
                  required when you have 2-factor authentication enabled.
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Gmail:</span>
                    <a
                      href="https://support.google.com/accounts/answer/185833"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 flex items-center"
                    >
                      Setup Guide <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Outlook:</span>
                    <a
                      href="https://support.microsoft.com/en-us/account-billing/using-app-passwords-with-apps-that-don-t-support-two-step-verification-5896ed9b-4263-e681-128a-a6f2979a7944"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 flex items-center"
                    >
                      Setup Guide <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Yahoo:</span>
                    <a
                      href="https://help.yahoo.com/kb/generate-manage-third-party-passwords-sln15241.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 flex items-center"
                    >
                      Setup Guide <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={() => handleSaveEmailSettings(true)}
                disabled={testingConnection || emailLoading}
                className="flex items-center"
              >
                {testingConnection ? "Testing..." : "Test & Save"}
              </Button>
              <Button
                onClick={() => handleSaveEmailSettings(false)}
                disabled={testingConnection || emailLoading}
                variant="outline"
              >
                {emailLoading ? "Saving..." : "Save Without Test"}
              </Button>
              {showEmailForm && emailSettings.email_configured && (
                <Button
                  onClick={() => setShowEmailForm(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Email Settings */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Email Settings</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Signature
            </label>
            <textarea
              value={settings.email_signature}
              onChange={(e) =>
                setSettings({ ...settings, email_signature: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              rows="4"
              placeholder="Best regards,&#10;Your Name&#10;Your Title&#10;Phone: xxx-xxx-xxxx"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Delay Between Emails (minutes)
              </label>
              <input
                type="number"
                value={settings.send_delay_min}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    send_delay_min: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                min="1"
                max="60"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Delay Between Emails (minutes)
              </label>
              <input
                type="number"
                value={settings.send_delay_max}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    send_delay_max: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                min="1"
                max="60"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Follow-up Reminder After (days)
            </label>
            <input
              type="number"
              value={settings.follow_up_days}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  follow_up_days: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              min="1"
              max="30"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="business-hours"
              checked={settings.business_hours_only}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  business_hours_only: e.target.checked,
                })
              }
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label
              htmlFor="business-hours"
              className="ml-2 text-sm text-gray-700"
            >
              Send emails during business hours only (9 AM - 6 PM)
            </label>
          </div>
        </div>

        <Button onClick={handleSaveSettings} className="mt-6 flex items-center">
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </div>

      {/* Resume Management */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Resume Management</h2>

        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resume Label *
            </label>
            <input
              type="text"
              value={resumeLabel}
              onChange={(e) => setResumeLabel(e.target.value)}
              placeholder="e.g. Frontend Developer Resume"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Resume File *
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleResumeUpload}
              disabled={uploading || !resumeLabel || resumes.length >= 10}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed file:disabled:bg-gray-100 file:disabled:text-gray-400"
            />
            {resumes.length >= 10 && (
              <p className="text-sm text-red-600 mt-1">
                Maximum 10 resumes allowed
              </p>
            )}{" "}
          </div>
        </div>

        <div className="space-y-3">
          {resumes.map((resume) => (
            <div
              key={resume.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center">
                <input
                  type="radio"
                  name="default-resume"
                  checked={settings.default_resume_id === resume.id}
                  onChange={() =>
                    setSettings({ ...settings, default_resume_id: resume.id })
                  }
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="ml-3">
                  <span className="text-sm font-medium">
                    {resume.display_name}
                    {settings.default_resume_id === resume.id && " ⭐"}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    File: {resume.file_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDeleteResume(resume.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
