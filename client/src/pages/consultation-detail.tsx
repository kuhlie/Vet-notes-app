import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, Calendar, Clock, User, FileText, Stethoscope, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { Consultation } from "@shared/schema";

export default function ConsultationDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [finalSoapNote, setFinalSoapNote] = useState("");
  const [isFinalized, setIsFinalized] = useState(false);

  const { data: consultation, isLoading } = useQuery<Consultation>({
    queryKey: [`/api/consultations/${id}`],
    enabled: !!id,
  });

  useEffect(() => {
    if (consultation) {
      setFinalSoapNote(consultation.finalSoapNote || consultation.aiSoapNote || "");
      setIsFinalized(Boolean(consultation.isFinalized));
    }
  }, [consultation]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { finalSoapNote: string; isFinalized: boolean }) => {
      return await apiRequest(`/api/consultations/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/consultations/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultations"] });
      toast({
        title: "Saved",
        description: "SOAP note updated successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to update SOAP note: " + error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Consultation Not Found</h2>
          <p className="text-gray-600 mb-4">The requested consultation could not be found.</p>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const downloadAudio = () => {
    if (consultation.id) {
      const link = document.createElement('a');
      link.href = `/api/consultations/${consultation.id}/download`;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const downloadTranscription = () => {
    if (consultation.id) {
      const link = document.createElement('a');
      link.href = `/api/consultations/${consultation.id}/export?type=transcript`;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const downloadSoapNote = () => {
    if (consultation.id) {
      const link = document.createElement('a');
      link.href = `/api/consultations/${consultation.id}/export?type=soap`;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center mr-3">
                <Stethoscope className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Consultation Details</h1>
                <p className="text-sm text-gray-500">View consultation transcript and summary</p>
              </div>
            </div>
            <Badge variant={consultation.status === 'completed' ? 'default' : 'secondary'}>
              {consultation.status || 'processing'}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Consultation Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Consultation Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Patient ID</p>
                    <p className="text-base">{consultation.patientId || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Date</p>
                    <p className="text-base">
                      {consultation.recordedAt ? 
                        new Date(consultation.recordedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 
                        'Processing...'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Pet Name</p>
                    <p className="text-base">{consultation.petName || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Client Name</p>
                    <p className="text-base">{consultation.customerName || "Unknown"}</p>
                  </div>
                  {consultation.duration && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Duration</p>
                      <p className="text-base">{Math.floor(consultation.duration / 60)}m {consultation.duration % 60}s</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
                    <Badge variant={consultation.status === 'completed' ? 'default' : 'secondary'}>
                      {consultation.status || 'processing'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SOAP Note */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Stethoscope className="w-5 h-5 mr-2" />
                  SOAP Note (Final)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={finalSoapNote}
                  onChange={(event) => setFinalSoapNote(event.target.value)}
                  placeholder="SOAP note will appear here once processing is complete."
                  rows={14}
                  className="font-mono text-sm"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-gray-600">
                    Status: {isFinalized ? "Finalized" : "Draft"}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      onClick={() => setIsFinalized((prev) => !prev)}
                    >
                      {isFinalized ? "Mark as Draft" : "Mark as Finalized"}
                    </Button>
                    <Button
                      onClick={() => updateMutation.mutate({ finalSoapNote, isFinalized })}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? "Saving..." : "Save SOAP Note"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {consultation.aiSoapNote && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Stethoscope className="w-5 h-5 mr-2" />
                    SOAP Note (AI Draft)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                      {consultation.aiSoapNote}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Full Transcription */}
            {consultation.fullTranscription && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Full Transcription
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {consultation.fullTranscription}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {consultation.audioUrl && (
                  <>
                    <Button
                      onClick={toggleAudio}
                      variant="outline"
                      className="w-full"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                      {isPlaying ? 'Pause' : 'Play'} Audio
                    </Button>
                    <Button
                      onClick={downloadAudio}
                      variant="outline"
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Audio
                    </Button>
                  </>
                )}
                {consultation.fullTranscription && (
                  <Button
                    onClick={downloadTranscription}
                    variant="outline"
                    className="w-full"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Download Transcript (.docx)
                  </Button>
                )}
                {(consultation.finalSoapNote || consultation.aiSoapNote) && (
                  <Button
                    onClick={downloadSoapNote}
                    variant="outline"
                    className="w-full"
                  >
                    <Stethoscope className="w-4 h-4 mr-2" />
                    Download SOAP Note (.docx)
                  </Button>
                )}
                <Link href="/customers">
                  <Button variant="outline" className="w-full">
                    <User className="w-4 h-4 mr-2" />
                    View Patient
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Consultation Info */}
            <Card>
              <CardHeader>
                <CardTitle>Consultation Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                  <span>
                    {consultation.recordedAt ? 
                      new Date(consultation.recordedAt).toLocaleDateString() : 
                      'Processing...'
                    }
                  </span>
                </div>
                {consultation.duration && (
                  <div className="flex items-center text-sm">
                    <Clock className="w-4 h-4 mr-2 text-gray-500" />
                    <span>{Math.floor(consultation.duration / 60)}m {consultation.duration % 60}s</span>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <FileText className="w-4 h-4 mr-2 text-gray-500" />
                  <span>{consultation.fileName}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Hidden audio element */}
        {consultation.audioUrl && (
          <audio
            ref={audioRef}
            src={`/api/consultations/${consultation.id}/audio`}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            preload="none"
          />
        )}
      </main>
    </div>
  );
}
