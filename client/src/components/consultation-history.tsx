import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, Download, Trash2, CheckCircle, Clock, AlertCircle, ArrowUpDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Consultation } from "@shared/schema";

export default function ConsultationHistory() {
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name'>('date-desc');
  const [filterText, setFilterText] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: consultations, isLoading } = useQuery<Consultation[]>({
    queryKey: ["/api/consultations"],
    refetchInterval: 5000, // Refresh every 5 seconds to check for completed transcriptions
  });

  const sortedConsultations = useMemo(() => {
    if (!consultations) return [];

    const normalizedText = filterText.trim().toLowerCase();
    const filtered = consultations.filter((consultation) => {
      const matchesText = normalizedText
        ? [
            consultation.patientId || "",
            consultation.petName || "",
            consultation.customerName || "",
          ].some((value) => value.toLowerCase().includes(normalizedText))
        : true;

      const matchesDate = filterDate
        ? consultation.recordedAt
          ? new Date(consultation.recordedAt).toISOString().split("T")[0] === filterDate
          : false
        : true;

      return matchesText && matchesDate;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime();
        case 'date-asc':
          return new Date(a.recordedAt || 0).getTime() - new Date(b.recordedAt || 0).getTime();
        case 'name':
          return (a.petName || a.patientId || a.customerName || "").localeCompare(
            b.petName || b.patientId || b.customerName || ""
          );
        default:
          return 0;
      }
    });
  }, [consultations, sortBy, filterDate, filterText]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/consultations/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Consultation deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/consultations"] });
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
        description: "Failed to delete consultation: " + error.message,
        variant: "destructive",
      });
    },
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "Unknown";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="mr-1" size={12} />
            Completed
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <Clock className="mr-1" size={12} />
            Processing
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <AlertCircle className="mr-1" size={12} />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {status}
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Consultations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading consultations...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Consultations</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder="Filter by patient ID, pet, or client"
              className="w-full sm:w-56"
            />
            <Input
              type="date"
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value)}
              className="w-full sm:w-40"
            />
            <Select value={sortBy} onValueChange={(value: 'date-desc' | 'date-asc' | 'name') => setSortBy(value)}>
              <SelectTrigger className="w-48">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest First</SelectItem>
                <SelectItem value="date-asc">Oldest First</SelectItem>
                <SelectItem value="name">By Patient</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!consultations || consultations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No consultations found. Start by recording your first consultation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedConsultations.map((consultation) => (
              <div 
                key={consultation.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {consultation.patientId || "Unknown ID"} - {consultation.petName || "Pet"}
                      </h4>
                      <p className="text-xs text-gray-500">Client: {consultation.customerName || "Unknown"}</p>
                    </div>
                    <span className="text-sm text-gray-500">
                      {consultation.recordedAt ? formatDate(consultation.recordedAt) : 'Unknown date'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {consultation.finalSoapNote
                      ? consultation.finalSoapNote.substring(0, 120) + "..."
                      : consultation.fullTranscription
                        ? consultation.fullTranscription.substring(0, 120) + "..."
                        : "Processing transcription..."
                    }
                  </p>
                  <div className="flex items-center space-x-4">
                    {getStatusBadge(consultation.status)}
                    {consultation.isFinalized && (
                      <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200">
                        Finalized
                      </Badge>
                    )}
                    <span className="text-xs text-gray-500">
                      Duration: {formatDuration(consultation.duration)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <Link href={`/consultation/${consultation.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                  </Link>
                  {consultation.fullTranscription ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2 text-gray-400 hover:text-primary"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            Consultation: {consultation.patientId || "Unknown ID"} - {consultation.petName || "Pet"}
                          </DialogTitle>
                          <p className="text-sm text-gray-500">
                            {consultation.recordedAt ? formatDate(consultation.recordedAt) : 'Unknown date'} - Duration: {formatDuration(consultation.duration)}
                          </p>
                        </DialogHeader>
                        <Tabs defaultValue="transcription" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="transcription">Transcription</TabsTrigger>
                            <TabsTrigger value="summary">SOAP Note</TabsTrigger>
                          </TabsList>
                          <TabsContent value="transcription" className="mt-4">
                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg max-h-96 overflow-y-auto">
                              <h4 className="font-medium mb-3">Full Transcription</h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                {consultation.fullTranscription}
                              </p>
                            </div>
                          </TabsContent>
                          <TabsContent value="summary" className="mt-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg max-h-96 overflow-y-auto">
                              <h4 className="font-medium mb-3">SOAP Note</h4>
                              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                {consultation.finalSoapNote ||
                                  consultation.aiSoapNote ||
                                  "SOAP note is being generated..."}
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-2 text-gray-400"
                      title="Transcription not ready"
                      disabled
                    >
                      <Eye size={16} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = `/api/consultations/${consultation.id}/download`;
                      link.download = '';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="p-2 text-gray-400 hover:text-primary"
                    title="Download Audio"
                    disabled={consultation.status !== 'completed' || !consultation.audioUrl}
                  >
                    <Download size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(consultation.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-gray-400 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}



