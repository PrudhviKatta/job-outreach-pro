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
  Zap,
  Timer,
  Info,
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
  campaignProgress = { sent: 0, failed: 0, total: 0 },
  onRetryFailed = () => {},
  onPauseSending = () => {},
  onResumeSending = () => {},
  isPaused = false,
  currentDelayInfo = null,
  // New campaign-related props
  campaignStatus = null,
  onStopSending = () => {},
  shouldStop = false,
  forceStop = false,
  onSendMethodSelect = () => {},
  showMethodSelection = false,
}) {
  const totalRecipients =
    campaignProgress.total ||
    recipients.length + sentRecipients.length + failedRecipients.length;
  const completedCount = campaignProgress.sent + campaignProgress.failed;
  const progressPercentage =
    totalRecipients > 0 ? (completedCount / totalRecipients) * 100 : 0;

  // NEW: Check if we can send immediately (20 recipient limit)
  const canSendImmediately = recipients.length <= 20 && recipients.length > 0;
  const needsBackgroundSending = recipients.length > 20;

  // NEW: Calculate estimated completion time for background sending
  const estimateBackgroundTime = (recipientCount) => {
    if (recipientCount === 0) return null;

    // Average 14 seconds between emails (8-20 range)
    const avgDelaySeconds = 14;
    const totalSeconds = recipientCount * avgDelaySeconds;

    if (totalSeconds < 3600) {
      const minutes = Math.ceil(totalSeconds / 60);
      return `~${minutes} minutes`;
    } else {
      const hours = Math.ceil(totalSeconds / 3600);
      return `~${hours} hours`;
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Recipients Progress</h2>
        {sending && (
          <div className="flex items-center space-x-4 text-sm">
            <span className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              Sent:{" "}
              <span className="font-bold ml-1">{campaignProgress.sent}</span>
            </span>
            <span className="flex items-center text-red-600">
              <XCircle className="w-4 h-4 mr-1" />
              Failed:{" "}
              <span className="font-bold ml-1">{campaignProgress.failed}</span>
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

      {/* NEW: Recipient Count Warning/Info */}
      {recipients.length > 0 && !sending && (
        <div
          className={`rounded-lg p-4 mb-4 ${
            needsBackgroundSending
              ? "bg-orange-50 border border-orange-200"
              : recipients.length > 15
              ? "bg-yellow-50 border border-yellow-200"
              : "bg-blue-50 border border-blue-200"
          }`}
        >
          <div className="flex items-start">
            {needsBackgroundSending ? (
              <Timer className="w-5 h-5 text-orange-600 mt-0.5 mr-3" />
            ) : recipients.length > 15 ? (
              <Info className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
            ) : (
              <Zap className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
            )}
            <div className="flex-1">
              {needsBackgroundSending ? (
                <>
                  <h3 className="font-medium text-orange-900">
                    Background Sending Required
                  </h3>
                  <p className="text-orange-800 text-sm mt-1">
                    {recipients.length} recipients exceed the 20-email limit for
                    immediate sending. This campaign will be queued for
                    background processing.
                  </p>
                  <p className="text-orange-700 text-xs mt-2">
                    📅 Estimated completion:{" "}
                    {estimateBackgroundTime(recipients.length)}
                  </p>
                </>
              ) : recipients.length > 15 ? (
                <>
                  <h3 className="font-medium text-yellow-900">
                    Close to Limit
                  </h3>
                  <p className="text-yellow-800 text-sm mt-1">
                    {recipients.length}/20 recipients. You can still send
                    immediately, but consider background sending for larger
                    campaigns.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-medium text-blue-900">Ready to Send</h3>
                  <p className="text-blue-800 text-sm mt-1">
                    {recipients.length} recipients ready for immediate sending.
                  </p>
                </>
              )}
            </div>
          </div>
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

      {/* Delay Info */}
      {currentDelayInfo && !currentlySending && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <div className="animate-pulse mr-3">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-orange-900">
                Delay between emails
              </p>
              <p className="text-sm text-orange-700">{currentDelayInfo}</p>
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

      {/* NEW: Updated Control Buttons */}
      <div className="pt-4 border-t">
        {showMethodSelection ? (
          // Method selection UI - UPDATED
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Choose Sending Method
            </h3>

            {/* Send Now Option - UPDATED */}
            <div
              className={`border-2 rounded-lg p-4 transition-all ${
                canSendImmediately
                  ? "border-indigo-200 hover:bg-indigo-50 cursor-pointer hover:border-indigo-300"
                  : "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
              }`}
              onClick={() =>
                canSendImmediately && onSendMethodSelect("realtime")
              }
            >
              <div className="flex items-start">
                <div className="text-2xl mr-3">⚡</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">
                    Send Now (Immediate)
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Perfect for urgent, small campaigns. Keep browser open.
                  </p>
                  <div className="mt-2 flex items-center space-x-4 text-xs">
                    <span
                      className={`px-2 py-1 rounded-full ${
                        canSendImmediately
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {canSendImmediately ? "✓" : "✗"} Limit: 20 emails
                    </span>
                    <span className="text-gray-500">
                      You have: {recipients.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Send in Background Option - UPDATED */}
            <div
              className={`border-2 rounded-lg p-4 transition-all ${
                recipients.length <= 500 && recipients.length > 0
                  ? "border-green-200 hover:bg-green-50 cursor-pointer hover:border-green-300"
                  : "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
              }`}
              onClick={() =>
                recipients.length <= 500 &&
                recipients.length > 0 &&
                onSendMethodSelect("background")
              }
            >
              <div className="flex items-start">
                <div className="text-2xl mr-3">🔄</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">
                    Send in Background {needsBackgroundSending && "(Required)"}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Works even when you close browser. Queued with other
                    campaigns.
                  </p>
                  <div className="mt-2 flex items-center space-x-4 text-xs">
                    <span
                      className={`px-2 py-1 rounded-full ${
                        recipients.length <= 500 && recipients.length > 0
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {recipients.length <= 500 && recipients.length > 0
                        ? "✓"
                        : "✗"}{" "}
                      Limit: 500 emails
                    </span>
                    {recipients.length > 0 && (
                      <span className="text-gray-500">
                        ETA: {estimateBackgroundTime(recipients.length)}
                      </span>
                    )}
                  </div>
                  {needsBackgroundSending && (
                    <div className="mt-2 text-xs text-orange-700 font-medium">
                      ⚠️ Required for campaigns over 20 recipients
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* NEW: Help text */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <p className="font-medium mb-1">
                💡 Which method should I choose?
              </p>
              <ul className="space-y-1 text-xs">
                <li>
                  • <strong>Send Now:</strong> Best for quick, urgent emails to
                  individuals
                </li>
                <li>
                  • <strong>Background:</strong> Best for bulk campaigns, runs
                  automatically
                </li>
              </ul>
            </div>
          </div>
        ) : sending ? (
          // Existing campaign controls when sending
          <div className="flex space-x-3">
            <Button
              onClick={isPaused ? onResumeSending : onPauseSending}
              variant="secondary"
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
            <Button onClick={onStopSending} variant="danger">
              <XCircle className="w-4 h-4 mr-2" />
              Stop
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
