"use client";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
  Mail,
  Clock,
  Upload,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Star,
  FileText,
  Save,
} from "lucide-react";
import Button from "@/components/UI/Button";

export default function SettingsPage() {
  const { data: session } = useSession();
  const fileInputRef = useRef(null);

  // General settings
  const [generalSettings, setGeneralSettings] = useState({
    delayPreset: "moderate",
    sendDelayMin: 8,
    sendDelayMax: 20,
    businessHoursOnly: true,
    followUpDays: 3,
    defaultResumeId: "",
  });

  // Email settings
  const [emailSettings, setEmailSettings] = useState({
    senderEmail: "",
    appPassword: "",
    emailConfigured: false,
    emailVerified: false,
  });

  // Resumes
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (session) {
      fetchSettings();
      fetchResumes();
    }
  }, [session]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/email/settings");
      const data = await res.json();
      if (data.success && data.data) {
        setEmailSettings((prev) => ({
          ...prev,
          senderEmail: data.data.senderEmail || "",
          emailConfigured: data.data.emailConfigured || false,
          emailVerified: data.data.emailVerified || false,
        }));
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResumes = async () => {
    try {
      const res = await fetch("/api/resumes");
      const data = await res.json();
      if (data.success) {
        setResumes(data.data);
      }
    } catch (error) {
      console.error("Error fetching resumes:", error);
    }
  };

  // Delay presets
  const delayPresets = {
    fast: { min: 3, max: 8, label: "Fast (3-8s)" },
    moderate: { min: 8, max: 20, label: "Moderate (8-20s)" },
    conservative: { min: 20, max: 45, label: "Conservative (20-45s)" },
    custom: { min: generalSettings.sendDelayMin, max: generalSettings.sendDelayMax, label: "Custom" },
  };

  const handleDelayPreset = (preset) => {
    const presetValues = delayPresets[preset];
    if (preset !== "custom") {
      setGeneralSettings({
        ...generalSettings,
        delayPreset: preset,
        sendDelayMin: presetValues.min,
        sendDelayMax: presetValues.max,
      });
    } else {
      setGeneralSettings({ ...generalSettings, delayPreset: preset });
    }
  };

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      // Validate
      if (generalSettings.sendDelayMin >= generalSettings.sendDelayMax) {
        toast.error("Min delay must be less than max delay");
        return;
      }

      const res = await fetch("/api/settings/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generalSettings),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Settings saved!");
      } else {
        toast.error(data.error || "Failed to save");
      }
    } catch (error) {
      toast.error("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmail = async (testConnection = false) => {
    if (!emailSettings.senderEmail || !emailSettings.appPassword) {
      toast.error("Email and app password are required");
      return;
    }

    if (testConnection) setTestingEmail(true);
    else setSaving(true);

    try {
      const res = await fetch("/api/email/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderEmail: emailSettings.senderEmail,
          appPassword: emailSettings.appPassword,
          testConnection,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setEmailSettings((prev) => ({
          ...prev,
          emailConfigured: true,
          emailVerified: data.verified,
        }));
      } else {
        toast.error(data.error || "Failed to save email settings");
      }
    } catch (error) {
      toast.error("Error saving email settings");
    } finally {
      setSaving(false);
      setTestingEmail(false);
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("displayName", file.name);

      const res = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Resume uploaded!");
        fetchResumes();
      } else {
        toast.error(data.error || "Upload failed");
      }
    } catch (error) {
      toast.error("Error uploading resume");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteResume = async (id) => {
    if (!confirm("Delete this resume?")) return;
    try {
      const res = await fetch(`/api/resumes?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Resume deleted");
        fetchResumes();
      }
    } catch (error) {
      toast.error("Error deleting resume");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900">Settings</h1>

      {/* Email Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center">
          <Mail className="w-5 h-5 mr-2 text-indigo-600" />
          Email Configuration
        </h2>

        {emailSettings.emailVerified && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center">
            <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
            <span className="text-green-800 text-sm">Email verified and ready</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sender Email
            </label>
            <input
              type="email"
              value={emailSettings.senderEmail}
              onChange={(e) =>
                setEmailSettings({ ...emailSettings, senderEmail: e.target.value })
              }
              placeholder="your.email@gmail.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              App Password
            </label>
            <input
              type="password"
              value={emailSettings.appPassword}
              onChange={(e) =>
                setEmailSettings({ ...emailSettings, appPassword: e.target.value })
              }
              placeholder="Your app-specific password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use an app-specific password, not your main password.
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 ml-1"
              >
                Generate for Gmail →
              </a>
            </p>
          </div>

          <div className="flex space-x-3">
            <Button onClick={() => handleSaveEmail(true)} disabled={testingEmail}>
              {testingEmail ? "Testing..." : "Save & Test Connection"}
            </Button>
            <Button
              onClick={() => handleSaveEmail(false)}
              variant="secondary"
              disabled={saving}
            >
              Save Without Testing
            </Button>
          </div>
        </div>
      </div>

      {/* Sending Speed */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-indigo-600" />
          Sending Speed
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {Object.entries(delayPresets).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => handleDelayPreset(key)}
              className={`p-3 rounded-lg border text-sm font-medium transition-colors ${generalSettings.delayPreset === key
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {generalSettings.delayPreset === "custom" && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Delay (seconds)
              </label>
              <input
                type="number"
                value={generalSettings.sendDelayMin}
                onChange={(e) =>
                  setGeneralSettings({
                    ...generalSettings,
                    sendDelayMin: parseInt(e.target.value) || 1,
                  })
                }
                min={1}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Delay (seconds)
              </label>
              <input
                type="number"
                value={generalSettings.sendDelayMax}
                onChange={(e) =>
                  setGeneralSettings({
                    ...generalSettings,
                    sendDelayMax: parseInt(e.target.value) || 5,
                  })
                }
                min={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={generalSettings.businessHoursOnly}
              onChange={(e) =>
                setGeneralSettings({
                  ...generalSettings,
                  businessHoursOnly: e.target.checked,
                })
              }
              className="rounded border-gray-300 text-indigo-600 mr-2"
            />
            <span className="text-sm text-gray-700">
              Send during business hours only (9am-5pm)
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Follow-up Reminder (days)
            </label>
            <input
              type="number"
              value={generalSettings.followUpDays}
              onChange={(e) =>
                setGeneralSettings({
                  ...generalSettings,
                  followUpDays: parseInt(e.target.value) || 3,
                })
              }
              min={1}
              max={30}
              className="w-32 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <Button onClick={handleSaveGeneral} disabled={saving} className="mt-4">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* Resume Management */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-indigo-600" />
          Resumes ({resumes.length}/10)
        </h2>

        <div className="space-y-3 mb-4">
          {resumes.map((resume) => (
            <div
              key={resume.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center">
                <FileText className="w-4 h-4 text-gray-500 mr-3" />
                <div>
                  <p className="font-medium text-sm">{resume.displayName}</p>
                  <p className="text-xs text-gray-500">
                    {resume.fileSize
                      ? `${(resume.fileSize / 1024).toFixed(1)} KB`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {generalSettings.defaultResumeId === resume.id && (
                  <span className="flex items-center text-xs text-yellow-600">
                    <Star className="w-3 h-3 mr-1" />
                    Default
                  </span>
                )}
                <button
                  onClick={() =>
                    setGeneralSettings({
                      ...generalSettings,
                      defaultResumeId: resume.id,
                    })
                  }
                  className="text-xs text-gray-500 hover:text-indigo-600"
                >
                  Set Default
                </button>
                <button
                  onClick={() => handleDeleteResume(resume.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {resumes.length === 0 && (
          <p className="text-gray-500 text-sm mb-4">No resumes uploaded yet.</p>
        )}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleResumeUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            disabled={uploading || resumes.length >= 10}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Uploading..." : "Upload Resume"}
          </Button>
          {resumes.length >= 10 && (
            <p className="text-xs text-amber-600 mt-1">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Maximum 10 resumes reached
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
