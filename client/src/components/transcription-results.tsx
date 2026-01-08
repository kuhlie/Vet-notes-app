import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Trash2, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Consultation } from "@shared/schema";

export default function TranscriptionResults() {
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);

  // This component would be used to display results of a specific consultation
  // For now, we'll show it when there's a selected consultation
  if (!selectedConsultation) {
    return null;
  }

  const isProcessing = selectedConsultation.status === 'processing';
  const isCompleted = selectedConsultation.status === 'completed';
  const isFailed = selectedConsultation.status === 'failed';

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Transcription Results</CardTitle>
      </CardHeader>
      <CardContent>
        {isProcessing && (
          <div className="text-center py-8">
            <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
              <Loader2 className="mr-2 animate-spin" size={16} />
              Processing audio transcription...
            </div>
          </div>
        )}

        {isFailed && (
          <div className="text-center py-8">
            <div className="inline-flex items-center px-4 py-2 bg-red-50 text-red-700 rounded-lg">
              Failed to process transcription. Please try again.
            </div>
          </div>
        )}

        {isCompleted && (
          <>
            <Tabs defaultValue="full" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="full">Full Transcription</TabsTrigger>
                <TabsTrigger value="clinical">SOAP Note</TabsTrigger>
              </TabsList>
              
              <TabsContent value="full" className="mt-6">
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {selectedConsultation.fullTranscription || "No transcription available"}
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="clinical" className="mt-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">SOAP Note</h4>
                  <div className="text-gray-800 whitespace-pre-wrap">
                    {selectedConsultation.finalSoapNote ||
                      selectedConsultation.aiSoapNote ||
                      "No SOAP note available"}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-end mt-6">
              <Button className="bg-primary hover:bg-blue-700">
                <Save className="mr-2" size={16} />
                Save Consultation
              </Button>
              
              <Button variant="secondary">
                <Trash2 className="mr-2" size={16} />
                Delete Recording
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
