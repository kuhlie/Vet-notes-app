import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Stethoscope, LogOut, Users, HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecordingControls from "@/components/recording-controls";
import TranscriptionResults from "@/components/transcription-results";
import ConsultationHistory from "@/components/consultation-history";

export default function Home() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center mr-3">
                <Stethoscope className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">VetRecord Pro</h1>
                <p className="text-sm text-gray-500">{"Veterinary Clinic"}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/customers">
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <Users size={16} />
                  <span>Patients</span>
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <HomeIcon size={16} />
                  <span>Home</span>
                </Button>
              </Link>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user?.email || 'User'}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <Button 
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <LogOut size={16} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RecordingControls />
        <TranscriptionResults />
        <ConsultationHistory />
      </main>
    </div>
  );
}

