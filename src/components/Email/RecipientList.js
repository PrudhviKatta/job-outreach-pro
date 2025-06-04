import Button from "@/components/UI/Button";
import {
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Pause,
  Play,
} from "lucide-react";

export default function RecipientList({
  recipients,
  onRemove,
  onSend,
  selectedResume,
  sending,
  // New props for real-time updates
  currentlySending = null,
  sentRecipients = [],
  failedRecipients = [],
  sendingProgress = { sent: 0, failed: 0, total: 0 },
  onRetryFailed = () => {},
  onPauseSending = () => {},
  onResumeSending = () => {},
  isPaused = false,
}) {
  const totalRecipients =
    sendingProgress.total ||
    recipients.length + sentRecipients.length + failedRecipients.length;
  const completedCount = sendingProgress.sent + sendingProgress.failed;
  const progressPercentage =
    totalRecipients > 0 ? (completedCount / totalRecipients) * 100 : 0;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Recipients Progress</h2>
        {sending && (
          <div className="flex items-center space-x-4 text-sm">
            <span className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              Sent:{" "}
              <span className="font-bold ml-1">{sendingProgress.sent}</span>
            </span>
            <span className="flex items-center text-red-600">
              <XCircle className="w-4 h-4 mr-1" />
              Failed:{" "}
              <span className="font-bold ml-1">{sendingProgress.failed}</span>
            </span>
            <span className="flex items-center text-blue-600">
              <Clock className="w-4 h-4 mr-1" />
              Remaining:{" "}
              <span className="font-bold ml-1">{recipients.length}</span>
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {sending && (
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Overall Progress</span>
            <span>
              {completedCount}/{totalRecipients} completed
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Resume Warning */}
      {!selectedResume && (recipients.length > 0 || sending) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-yellow-800 text-sm">
            ⚠️ No resume selected - emails will be sent without attachment
          </p>
        </div>
      )}

      {/* Currently Sending */}
      {currentlySending && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <div className="animate-spin mr-3">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-blue-900">Currently sending to:</p>
              <p className="text-sm text-blue-700">
                {currentlySending.name} • {currentlySending.email}
              </p>
              {currentlySending.company && (
                <p className="text-xs text-blue-600">
                  {currentlySending.company}
                  {currentlySending.position &&
                    ` • ${currentlySending.position}`}
                </p>
              )}
            </div>
            <div className="text-blue-600 text-sm">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-2"></div>
                {isPaused ? "Paused" : "Sending..."}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Waiting Recipients */}
      {recipients.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-medium text-gray-700">
            {sending
              ? `Waiting to Send (${recipients.length})`
              : `Recipients (${recipients.length})`}
          </h3>

          {recipients.map((recipient) => (
            <div
              key={recipient.id}
              className="flex justify-between items-start p-3 bg-gray-50 rounded-lg border border-gray-200"
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
              <div className="flex items-center space-x-2">
                {sending ? (
                  <div className="flex items-center text-gray-500">
                    <Clock className="w-4 h-4 mr-1" />
                    <span className="text-xs">Queued</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onRemove(recipient.id)}
                    className="text-red-600 hover:text-red-700"
                    disabled={sending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Successfully Sent */}
      {sentRecipients.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-medium text-green-700">
            Successfully Sent ({sentRecipients.length})
          </h3>

          {sentRecipients.map((recipient) => (
            <div
              key={`sent-${recipient.id}`}
              className="bg-green-50 border border-green-200 rounded-lg p-3"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-green-800">{recipient.name}</p>
                  <p className="text-sm text-green-700">{recipient.email}</p>
                  {recipient.company && (
                    <p className="text-xs text-green-600">
                      {recipient.company}
                      {recipient.position && ` • ${recipient.position}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center text-green-600">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  <span className="text-xs">
                    {recipient.sentAt
                      ? new Date(recipient.sentAt).toLocaleTimeString()
                      : "Sent"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Failed Recipients */}
      {failedRecipients.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-medium text-red-700">
            Failed to Send ({failedRecipients.length})
          </h3>

          {failedRecipients.map((recipient) => (
            <div
              key={`failed-${recipient.id}`}
              className="bg-red-50 border border-red-200 rounded-lg p-3"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-red-800">{recipient.name}</p>
                  <p className="text-sm text-red-700">{recipient.email}</p>
                  {recipient.company && (
                    <p className="text-xs text-red-600">
                      {recipient.company}
                      {recipient.position && ` • ${recipient.position}`}
                    </p>
                  )}
                  {recipient.error && (
                    <p className="text-xs text-red-500 mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Error: {recipient.error}
                    </p>
                  )}
                </div>
                <div className="flex flex-col space-y-1">
                  <button
                    onClick={() => onRetryFailed([recipient])}
                    className="flex items-center text-red-600 hover:text-red-700 text-xs"
                    disabled={sending}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </button>
                  <button
                    onClick={() => onRemove(`failed-${recipient.id}`)}
                    className="flex items-center text-gray-500 hover:text-gray-700 text-xs"
                    disabled={sending}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Recipients */}
      {recipients.length === 0 &&
        sentRecipients.length === 0 &&
        failedRecipients.length === 0 &&
        !sending && (
          <p className="text-gray-500 text-center py-8">
            No recipients added yet
          </p>
        )}

      {/* Control Buttons */}
      <div className="flex space-x-3 pt-4 border-t">
        {!sending && recipients.length > 0 && (
          <Button
            onClick={onSend}
            className="flex items-center justify-center flex-1"
          >
            <Send className="w-4 h-4 mr-2" />
            Send All Emails
          </Button>
        )}

        {sending && (
          <>
            <Button
              onClick={isPaused ? onResumeSending : onPauseSending}
              variant="secondary"
              className="flex items-center"
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              )}
            </Button>

            {failedRecipients.length > 0 && (
              <Button
                onClick={() => onRetryFailed(failedRecipients)}
                variant="warning"
                className="flex items-center"
                disabled={isPaused}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Failed ({failedRecipients.length})
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
