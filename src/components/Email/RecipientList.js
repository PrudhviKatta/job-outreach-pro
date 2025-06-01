import Button from "@/components/UI/Button";
import { Trash2, Send } from "lucide-react";

export default function RecipientList({ recipients, onRemove, onSend }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">
        Recipients ({recipients.length})
      </h2>

      {recipients.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No recipients added yet
        </p>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {recipients.map((recipient) => (
              <div
                key={recipient.id}
                className="flex justify-between items-start p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{recipient.name}</p>
                  <p className="text-sm text-gray-600">{recipient.email}</p>
                  {recipient.company && (
                    <p className="text-sm text-gray-500">
                      {recipient.company}
                      {recipient.position && ` • ${recipient.position}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRemove(recipient.id)}
                  className="ml-4 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <Button
            onClick={onSend}
            className="w-full flex items-center justify-center"
          >
            <Send className="w-4 h-4 mr-2" />
            Send All Emails
          </Button>
        </>
      )}
    </div>
  );
}
