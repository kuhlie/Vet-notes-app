import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Play, Pause, Square, Plus } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Customer, InsertCustomer } from "@shared/schema";

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export default function RecordingControls() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [duration, setDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<InsertCustomer>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch customers for selection
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Create customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: InsertCustomer) => {
      return await apiRequest("/api/customers", {
        method: "POST",
        body: JSON.stringify(customerData),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (newCustomer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setSelectedCustomerId(newCustomer.id.toString());
      setCustomerName(newCustomer.name);
      setIsCreateCustomerOpen(false);
      setNewCustomer({});
      toast({
        title: "Success",
        description: "Patient created successfully",
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
        description: "Failed to create patient: " + error.message,
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { audioBlob: Blob; customerName: string; customerId?: string }) => {
      const formData = new FormData();
      // Use appropriate file extension based on MIME type
      const fileName = data.audioBlob.type.includes('wav') ? 'recording.wav' : 
                      data.audioBlob.type.includes('ogg') ? 'recording.ogg' :
                      data.audioBlob.type.includes('mp4') ? 'recording.mp4' : 'recording.webm';
      formData.append('audio', data.audioBlob, fileName);
      formData.append('customerName', data.customerName);
      if (data.customerId) {
        formData.append('customerId', data.customerId);
      }
      
      const response = await fetch('/api/consultations', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Recording uploaded successfully. Processing transcription...",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/consultations"] });
      resetRecordingState();
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
        description: "Failed to upload recording: " + error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startTimer = () => {
    intervalRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resetRecordingState = () => {
    setRecordingState('idle');
    setDuration(0);
    setAudioChunks([]);
    setMediaRecorder(null);
    setConsentConfirmed(false);
    stopTimer();
  };

  const startRecording = async () => {
    if (!customerName.trim()) {
      toast({
        title: "Error",
        description: "Please select a patient before recording",
        variant: "destructive",
      });
      return;
    }
    if (!consentConfirmed) {
      toast({
        title: "Consent Required",
        description: "Please confirm client consent before recording.",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      // Use a more compatible format for recording
      let options: MediaRecorderOptions = {};
      
      // Prefer formats that are more likely to work with OpenAI
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        options = { mimeType: 'audio/ogg;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else {
        // Fallback to default
        options = {};
      }
      
      const recorder = new MediaRecorder(stream, options);
      
      // Collect chunks more frequently to ensure data integrity
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      // Start with a time slice to ensure we get data chunks
      recorder.start(1000); // Record in 1-second chunks
      setRecordingState('recording');
      startTimer();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start recording. Please check microphone permissions.",
        variant: "destructive",
      });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && recordingState === 'recording') {
      mediaRecorder.pause();
      setRecordingState('paused');
      stopTimer();
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && recordingState === 'paused') {
      mediaRecorder.resume();
      setRecordingState('recording');
      startTimer();
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      stopTimer();
      
      // Wait for final data and create blob
      setTimeout(() => {
        if (audioChunks.length === 0) {
          toast({
            title: "Error", 
            description: "No audio data was recorded. Please try again.",
            variant: "destructive",
          });
          resetRecordingState();
          return;
        }

        // Create audio blob with proper MIME type
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        
        // Verify blob has content
        if (audioBlob.size === 0) {
          toast({
            title: "Error",
            description: "Recording is empty. Please try again.",
            variant: "destructive",
          });
          resetRecordingState();
          return;
        }

        console.log(`Created audio blob: ${audioBlob.size} bytes, type: ${mimeType}`);
        uploadMutation.mutate({ audioBlob, customerName, customerId: selectedCustomerId });
        resetRecordingState();
      }, 100); // Small delay to ensure all data is collected
    }
  };

  const getStatusColor = () => {
    switch (recordingState) {
      case 'recording': return 'bg-red-500 animate-pulse';
      case 'paused': return 'bg-yellow-500';
      case 'stopped': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (recordingState) {
      case 'recording': return 'Recording...';
      case 'paused': return 'Paused';
      case 'stopped': return 'Processing...';
      default: return 'Ready to Record';
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-center">New Consultation</CardTitle>
        <p className="text-center text-gray-600">Record and transcribe your veterinary consultation</p>
      </CardHeader>
      <CardContent>
        {/* Customer Selection */}
        <div className="mb-6">
          <Label htmlFor="customer">Select Patient *</Label>
          <div className="flex gap-2 mt-2">
            <Select 
              value={selectedCustomerId} 
              onValueChange={(value) => {
                setSelectedCustomerId(value);
                const selectedCustomer = customers?.find(c => c.id.toString() === value);
                if (selectedCustomer) {
                  setCustomerName(selectedCustomer.name);
                }
              }}
              disabled={recordingState !== 'idle'}
            >
              <SelectTrigger className="flex-1">
              <SelectValue placeholder="Choose a patient or add new one" />
              </SelectTrigger>
              <SelectContent>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id.toString()}>
                    <div className="flex items-center">
                      <span className="font-medium">{customer.patientId}</span>
                      <span className="ml-2">{customer.petName || "Pet"}</span>
                      <span className="ml-2 text-sm text-gray-500">({customer.name})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={isCreateCustomerOpen} onOpenChange={setIsCreateCustomerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={recordingState !== 'idle'}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Patient
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Patient</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="newPatientId">Patient ID *</Label>
                    <Input
                      id="newPatientId"
                      value={newCustomer.patientId || ""}
                      onChange={(e) => setNewCustomer({ ...newCustomer, patientId: e.target.value })}
                      placeholder="Enter patient ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newCustomerName">Client Name *</Label>
                    <Input
                      id="newCustomerName"
                      value={newCustomer.name || ""}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      placeholder="Enter client name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPetName">Pet Name</Label>
                    <Input
                      id="newPetName"
                      value={newCustomer.petName || ""}
                      onChange={(e) => setNewCustomer({ ...newCustomer, petName: e.target.value })}
                      placeholder="Pet's name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPetBreed">Pet Breed</Label>
                    <Input
                      id="newPetBreed"
                      value={newCustomer.petBreed || ""}
                      onChange={(e) => setNewCustomer({ ...newCustomer, petBreed: e.target.value })}
                      placeholder="Breed"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPhone">Phone</Label>
                    <Input
                      id="newPhone"
                      value={newCustomer.phone || ""}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                  <div className="flex justify-end space-x-2 mt-6">
                    <Button variant="outline" onClick={() => setIsCreateCustomerOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => {
                      if (!newCustomer.patientId?.trim() || !newCustomer.name?.trim()) {
                        toast({
                          title: "Error",
                          description: "Patient ID and client name are required",
                          variant: "destructive",
                        });
                        return;
                      }
                      createCustomerMutation.mutate(newCustomer as InsertCustomer);
                    }}
                    disabled={createCustomerMutation.isPending}
                  >
                    {createCustomerMutation.isPending ? "Creating..." : "Create Patient"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {!customers || customers.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">
              No patients found. <span className="text-blue-600 cursor-pointer" onClick={() => setIsCreateCustomerOpen(true)}>Add your first patient</span> to begin.
            </p>
          ) : null}
        </div>

        {/* Consent Reminder */}
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="consentConfirmed"
              checked={consentConfirmed}
              onCheckedChange={(value) => setConsentConfirmed(Boolean(value))}
              disabled={recordingState !== 'idle'}
            />
            <div>
              <Label htmlFor="consentConfirmed" className="text-sm font-medium text-amber-900">
                Client consent confirmed
              </Label>
              <p className="text-xs text-amber-700 mt-1">
                Please remind the client and confirm consent before recording.
              </p>
            </div>
          </div>
        </div>

        {/* Recording Status Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className={`h-3 w-3 rounded-full mr-2 ${getStatusColor()}`}></div>
              <span className="text-sm font-medium text-gray-700">{getStatusText()}</span>
            </div>
            <div className="text-sm text-gray-500">{formatDuration(duration)}</div>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {recordingState === 'idle' && (
            <Button 
              onClick={startRecording}
              className="bg-secondary hover:bg-green-700 text-lg sm:text-xl lg:text-2xl px-8 sm:px-12 py-6 sm:py-8 w-full sm:w-auto"
              disabled={!selectedCustomerId || !customerName.trim() || !consentConfirmed}
            >
              <Play className="mr-2" size={32} />
              Start Recording
            </Button>
          )}
          
          {recordingState === 'recording' && (
            <>
              <Button 
                onClick={pauseRecording}
                className="bg-warning hover:bg-yellow-600 text-lg sm:text-xl lg:text-2xl px-8 sm:px-12 py-6 sm:py-8 w-full sm:w-auto"
              >
                <Pause className="mr-2" size={32} />
                Pause
              </Button>
              <Button 
                onClick={stopRecording}
                className="bg-accent hover:bg-red-700 text-lg sm:text-xl lg:text-2xl px-8 sm:px-12 py-6 sm:py-8 w-full sm:w-auto"
              >
                <Square className="mr-2" size={32} />
                Finish & Process
              </Button>
            </>
          )}
          
          {recordingState === 'paused' && (
            <>
              <Button 
                onClick={resumeRecording}
                className="bg-secondary hover:bg-green-700 text-lg sm:text-xl lg:text-2xl px-8 sm:px-12 py-6 sm:py-8 w-full sm:w-auto"
              >
                <Play className="mr-2" size={32} />
                Resume
              </Button>
              <Button 
                onClick={stopRecording}
                className="bg-accent hover:bg-red-700 text-lg sm:text-xl lg:text-2xl px-8 sm:px-12 py-6 sm:py-8 w-full sm:w-auto"
              >
                <Square className="mr-2" size={32} />
                Finish & Process
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

