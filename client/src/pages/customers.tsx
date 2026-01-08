import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Plus, Eye, Trash2, User, Phone, Mail, MapPin, Heart, Stethoscope, LogOut, Users, HomeIcon } from "lucide-react";
import type { Customer, InsertCustomer } from "@shared/schema";

export default function Customers() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<InsertCustomer>>({});
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  };

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Fetch consultations for selected customer
  const { data: selectedCustomerConsultations, isLoading: consultationsLoading } = useQuery({
    queryKey: [`/api/customers/${selectedCustomer?.id}/consultations`],
    enabled: !!selectedCustomer && isViewDialogOpen,
    refetchOnWindowFocus: false,
    staleTime: 0, // Always refetch when query key changes
  });

  const createMutation = useMutation({
    mutationFn: async (customerData: InsertCustomer) => {
      return await apiRequest("/api/customers", {
        method: "POST",
        body: JSON.stringify(customerData),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsCreateDialogOpen(false);
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

  const deleteMutation = useMutation({
    mutationFn: async (customerId: number) => {
      return await apiRequest(`/api/customers/${customerId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Success",
        description: "Patient deleted successfully",
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
        description: "Failed to delete patient: " + error.message,
        variant: "destructive",
      });
    },
  });



  const handleCreateCustomer = () => {
    if (!newCustomer.patientId?.trim() || !newCustomer.name?.trim()) {
      toast({
        title: "Error",
        description: "Patient ID and client name are required",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(newCustomer as InsertCustomer);
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsViewDialogOpen(true);
    // Invalidate consultation query to refetch for the new customer
    queryClient.invalidateQueries({ 
      queryKey: [`/api/customers/${customer.id}/consultations`] 
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
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
                <Button variant="ghost" size="sm" className="flex items-center space-x-2 bg-gray-100">
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Patient Management</h1>
            <p className="text-gray-600 mt-2">Manage patient IDs, client details, and pet information</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add New Patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Patient</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient ID *</Label>
                <Input
                  id="patientId"
                  value={newCustomer.patientId || ""}
                  onChange={(e) => setNewCustomer({ ...newCustomer, patientId: e.target.value })}
                  placeholder="Patient ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Client Name *</Label>
                <Input
                  id="name"
                  value={newCustomer.name || ""}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="Enter client name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCustomer.email || ""}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  placeholder="client@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newCustomer.phone || ""}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="petName">Pet Name</Label>
                <Input
                  id="petName"
                  value={newCustomer.petName || ""}
                  onChange={(e) => setNewCustomer({ ...newCustomer, petName: e.target.value })}
                  placeholder="Pet's name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="petBreed">Pet Breed</Label>
                <Input
                  id="petBreed"
                  value={newCustomer.petBreed || ""}
                  onChange={(e) => setNewCustomer({ ...newCustomer, petBreed: e.target.value })}
                  placeholder="Breed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="petAge">Pet Age</Label>
                <Input
                  id="petAge"
                  value={newCustomer.petAge || ""}
                  onChange={(e) => setNewCustomer({ ...newCustomer, petAge: e.target.value })}
                  placeholder="Age (e.g., 3 years)"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={newCustomer.address || ""}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  placeholder="Client address"
                  rows={2}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newCustomer.notes || ""}
                  onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                  placeholder="Additional notes about the patient or client"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateCustomer} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Patient"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!customers || customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No patients yet</h3>
            <p className="text-gray-500 text-center mb-4">
              Start by adding your first patient to begin tracking consultations
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Patient
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{customer.patientId}</CardTitle>
                    <p className="text-sm text-gray-500">{customer.petName || "Pet"}</p>
                    <p className="text-xs text-gray-400">Client: {customer.name}</p>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewCustomer(customer)}
                      className="p-2"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(customer.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {customer.petName && (
                    <div className="flex items-center text-sm">
                      <Heart className="w-4 h-4 mr-2 text-pink-500" />
                      <span className="font-medium">{customer.petName}</span>
                      {customer.petBreed && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {customer.petBreed}
                        </Badge>
                      )}
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="w-4 h-4 mr-2" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="w-4 h-4 mr-2" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span className="truncate">{customer.address}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Customer Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {selectedCustomer.patientId}
                  <span className="text-pink-500 ml-2">- {selectedCustomer.petName || "Pet"}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Client Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2 text-gray-500" />
                      <span>{selectedCustomer.name}</span>
                    </div>
                    {selectedCustomer.email && (
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2 text-gray-500" />
                        <a 
                          href={`mailto:${selectedCustomer.email}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {selectedCustomer.email}
                        </a>
                      </div>
                    )}
                    {selectedCustomer.phone && (
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 mr-2 text-gray-500" />
                        <span>{selectedCustomer.phone}</span>
                      </div>
                    )}
                    {selectedCustomer.address && (
                      <div className="flex items-start">
                        <MapPin className="w-4 h-4 mr-2 text-gray-500 mt-0.5" />
                        <span>{selectedCustomer.address}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Pet Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Badge variant="outline">Patient ID: {selectedCustomer.patientId}</Badge>
                    </div>
                    {selectedCustomer.petName && (
                      <div className="flex items-center">
                        <Heart className="w-4 h-4 mr-2 text-pink-500" />
                        <span>Name: {selectedCustomer.petName}</span>
                      </div>
                    )}
                    {selectedCustomer.petBreed && (
                      <div>
                        <span className="text-sm text-gray-600">Breed: </span>
                        <Badge variant="outline">{selectedCustomer.petBreed}</Badge>
                      </div>
                    )}
                    {selectedCustomer.petAge && (
                      <div>
                        <span className="text-sm text-gray-600">Age: {selectedCustomer.petAge}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {selectedCustomer.notes && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                    {selectedCustomer.notes}
                  </p>
                </div>
              )}

              <div className="mt-6">
                <h3 className="font-semibold mb-3">Consultation History</h3>
                {consultationsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2 text-sm text-gray-600">Loading consultations...</span>
                  </div>
                ) : selectedCustomerConsultations && selectedCustomerConsultations.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomerConsultations.map((consultation: any) => (
                      <div key={consultation.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <span className="font-medium">
                            {consultation.recordedAt ? 
                              new Date(consultation.recordedAt).toLocaleDateString() : 
                              "Processing date..."
                            }
                          </span>
                          <p className="text-sm text-gray-600">
                            {consultation.fullTranscription ? 
                              consultation.fullTranscription.substring(0, 100) + "..." : 
                              "Transcription in progress..."
                            }
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={consultation.status === 'completed' ? 'default' : 'secondary'}>
                            {consultation.status || 'processing'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Navigate to consultation detail view
                              window.open(`/consultation/${consultation.id}`, '_blank');
                            }}
                            disabled={consultation.status !== 'completed'}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No consultations yet</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      </main>
    </div>
  );
}

