"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Upload, Trash2, Plus } from "lucide-react";
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
  const [resumes, setResumes] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resumeLabel, setResumeLabel] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Fetch user settings
      const { data: settingsData } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (settingsData) {
        setSettings(settingsData);
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
