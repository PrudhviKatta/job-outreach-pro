"use client";
import { useState } from "react";
import { Copy, Check, UserPlus, MessageSquare } from "lucide-react";
import Button from "@/components/UI/Button";
import toast from "react-hot-toast";

export default function LinkedInQueue({ contacts, templates, messageType }) {
  const [copiedId, setCopiedId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const generateMessage = (contact, template) => {
    if (!template) return "";

    const variables = {
      name: contact.name,
      company: contact.company || "",
      position: contact.position || "",
      agency: contact.agency || "",
    };

    let message = template.body;
    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      message = message.replace(regex, variables[key]);
    });

    return message;
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedId(null), 3000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const markAsSent = async (contactId) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("outreach_history").insert({
        user_id: user.id,
        contact_id: contactId,
        template_id: selectedTemplate,
        type:
          messageType === "connection"
            ? "linkedin_connection"
            : "linkedin_message",
        status: "sent",
      });

      toast.success("Marked as sent!");
    } catch (error) {
      toast.error("Error marking as sent");
    }
  };

  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-md">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Template
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Choose a template...</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      {contacts.map((contact) => {
        const message = selectedTemplateData
          ? generateMessage(contact, selectedTemplateData)
          : "";

        return (
          <div key={contact.id} className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{contact.name}</h3>
                <p className="text-gray-600">
                  {contact.company || contact.agency}
                  {contact.position && ` • ${contact.position}`}
                </p>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                Pending
              </span>
            </div>

            {selectedTemplateData && (
              <>
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <p className="text-gray-700 italic">{message}</p>
                </div>

                <div className="flex space-x-3">
                  <Button
                    onClick={() => copyToClipboard(message, contact.id)}
                    variant="primary"
                    size="sm"
                    className="flex items-center"
                  >
                    {copiedId === contact.id ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Message
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => markAsSent(contact.id)}
                    variant="secondary"
                    size="sm"
                  >
                    Mark as Sent
                  </Button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
