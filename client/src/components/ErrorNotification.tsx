import { useState, useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// This component works with the toast system, but also provides a fixed notification
// for more prominent errors

interface ErrorNotificationState {
  visible: boolean;
  message: string;
}

// Create a global error handler that components can use
let globalSetError: (message: string) => void = () => {};

export function showGlobalError(message: string) {
  globalSetError(message);
}

export default function ErrorNotification() {
  const [error, setError] = useState<ErrorNotificationState>({
    visible: false,
    message: ""
  });
  const { toast } = useToast();

  // Initialize the global error setter
  useEffect(() => {
    globalSetError = (message: string) => {
      setError({
        visible: true,
        message
      });
      
      // Also show as toast for less serious errors
      toast({
        variant: "destructive",
        title: "エラーが発生しました",
        description: message,
      });
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        setError(prev => ({ ...prev, visible: false }));
      }, 5000);
    };
    
    // Handle unexpected errors
    const handleUnexpectedError = (event: ErrorEvent) => {
      globalSetError("予期せぬエラーが発生しました: " + event.message);
    };
    
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      globalSetError("処理に失敗しました: " + event.reason);
    };
    
    // Register global error handlers
    window.addEventListener('error', handleUnexpectedError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    // Clean up
    return () => {
      window.removeEventListener('error', handleUnexpectedError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [toast]);

  const closeNotification = () => {
    setError({ ...error, visible: false });
  };

  if (!error.visible) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-md w-full bg-red-500 text-white p-4 rounded-lg shadow-lg z-50">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 mr-3 mt-0.5" />
        <div className="flex-grow">
          <h4 className="font-medium mb-1">エラーが発生しました</h4>
          <p className="text-sm opacity-90">{error.message}</p>
        </div>
        <button 
          className="text-white opacity-70 hover:opacity-100"
          onClick={closeNotification}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
