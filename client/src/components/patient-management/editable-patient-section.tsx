import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  AlertTriangle,
  Activity,
  Pill,
  FileText,
  Loader2
} from "lucide-react";
import { format } from "date-fns";

interface MedicalAlert {
  id: number;
  type: string;
  severity: "low" | "medium" | "high";
  title: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

interface PatientActivity {
  id: number;
  activityType: string;
  title: string;
  description?: string;
  date: string;
  metadata?: any;
}

interface Prescription {
  id: number;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  prescribedDate: string;
  isActive: boolean;
  refills: number;
  notes?: string;
}

interface MedicalHistoryEntry {
  id: number;
  category: string;
  title: string;
  description?: string;
  date?: string;
  isActive: boolean;
  createdAt: string;
}

interface EditableSectionProps {
  patientId: number;
  title: string;
  icon: React.ReactNode;
  data: any[];
  type: "alerts" | "activity" | "prescriptions" | "history";
  isLoading?: boolean;
}

export function EditablePatientSection({ 
  patientId, 
  title, 
  icon, 
  data, 
  type, 
  isLoading 
}: EditableSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getApiEndpoint = () => {
    switch (type) {
      case "alerts": return `/api/patients/${patientId}/medical-alerts`;
      case "activity": return `/api/patients/${patientId}/activity`;
      case "prescriptions": return `/api/patients/${patientId}/prescriptions`;
      case "history": return `/api/patients/${patientId}/medical-history`;
    }
  };

  const getQueryKey = () => {
    switch (type) {
      case "alerts": return [`/api/patients/${patientId}/medical-alerts`];
      case "activity": return [`/api/patients/${patientId}/activity`];
      case "prescriptions": return [`/api/patients/${patientId}/prescriptions`];
      case "history": return [`/api/patients/${patientId}/medical-history`];
    }
  };

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(getApiEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to add item");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getQueryKey() });
      setIsAddDialogOpen(false);
      setFormData({});
      toast({
        title: "Success",
        description: `${title.slice(0, -1)} added successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: `Failed to add ${title.toLowerCase().slice(0, -1)}`,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/${type === "alerts" ? "medical-alerts" : type === "activity" ? "patient-activity" : type === "history" ? "medical-history" : type}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to update item");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getQueryKey() });
      setEditingItem(null);
      setFormData({});
      toast({
        title: "Success",
        description: `${title.slice(0, -1)} updated successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: `Failed to update ${title.toLowerCase().slice(0, -1)}`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/${type === "alerts" ? "medical-alerts" : type === "activity" ? "patient-activity" : type === "history" ? "medical-history" : type}/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete item");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getQueryKey() });
      toast({
        title: "Success",
        description: `${title.slice(0, -1)} deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: `Failed to delete ${title.toLowerCase().slice(0, -1)}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      addMutation.mutate(formData);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData(item);
  };

  const handleDelete = (id: number) => {
    if (confirm(`Are you sure you want to delete this ${title.toLowerCase().slice(0, -1)}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const renderFormFields = () => {
    switch (type) {
      case "alerts":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Input
                  id="type"
                  value={formData.type || ""}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  placeholder="e.g., Allergy, Drug Interaction"
                />
              </div>
              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select
                  value={formData.severity || "medium"}
                  onValueChange={(value) => setFormData({ ...formData, severity: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title || ""}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Alert title"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details..."
              />
            </div>
          </>
        );

      case "activity":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="activityType">Activity Type</Label>
                <Select
                  value={formData.activityType || ""}
                  onValueChange={(value) => setFormData({ ...formData, activityType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem value="lab_result">Lab Result</SelectItem>
                    <SelectItem value="medication_change">Medication Change</SelectItem>
                    <SelectItem value="vital_signs">Vital Signs</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="datetime-local"
                  value={formData.date ? new Date(formData.date).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title || ""}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Activity title"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Activity details..."
              />
            </div>
          </>
        );

      case "prescriptions":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="medicationName">Medication Name</Label>
                <Input
                  id="medicationName"
                  value={formData.medicationName || ""}
                  onChange={(e) => setFormData({ ...formData, medicationName: e.target.value })}
                  placeholder="e.g., Metformin"
                  required
                />
              </div>
              <div>
                <Label htmlFor="dosage">Dosage</Label>
                <Input
                  id="dosage"
                  value={formData.dosage || ""}
                  onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                  placeholder="e.g., 500mg"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <Input
                  id="frequency"
                  value={formData.frequency || ""}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  placeholder="e.g., Twice daily"
                  required
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration</Label>
                <Input
                  id="duration"
                  value={formData.duration || ""}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="e.g., 30 days"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.instructions || ""}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="Special instructions..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="refills">Refills</Label>
                <Input
                  id="refills"
                  type="number"
                  value={formData.refills || 0}
                  onChange={(e) => setFormData({ ...formData, refills: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="prescribedDate">Prescribed Date</Label>
                <Input
                  id="prescribedDate"
                  type="date"
                  value={formData.prescribedDate ? new Date(formData.prescribedDate).toISOString().split('T')[0] : ""}
                  onChange={(e) => setFormData({ ...formData, prescribedDate: e.target.value })}
                />
              </div>
            </div>
          </>
        );

      case "history":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category || ""}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="surgery">Surgery</SelectItem>
                    <SelectItem value="condition">Medical Condition</SelectItem>
                    <SelectItem value="family_history">Family History</SelectItem>
                    <SelectItem value="allergy">Allergy</SelectItem>
                    <SelectItem value="hospitalization">Hospitalization</SelectItem>
                    <SelectItem value="procedure">Procedure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date ? new Date(formData.date).toISOString().split('T')[0] : ""}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title || ""}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Medical history entry title"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details..."
              />
            </div>
          </>
        );
    }
  };

  const renderListItem = (item: any) => {
    switch (type) {
      case "alerts":
        return (
          <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">{item.title}</span>
                <Badge variant={item.severity === "high" ? "destructive" : item.severity === "medium" ? "default" : "secondary"}>
                  {item.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{item.type}</p>
              {item.description && (
                <p className="text-sm mt-1">{item.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(item.createdAt), "PPP")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(item)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case "activity":
        return (
          <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4" />
                <span className="font-medium">{item.title}</span>
                <Badge variant="outline">{item.activityType}</Badge>
              </div>
              {item.description && (
                <p className="text-sm mt-1">{item.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(item.date), "PPP p")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(item)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case "prescriptions":
        return (
          <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Pill className="h-4 w-4" />
                <span className="font-medium">{item.medicationName}</span>
                <Badge variant={item.isActive ? "default" : "secondary"}>
                  {item.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {item.dosage} - {item.frequency}
              </p>
              {item.duration && (
                <p className="text-sm text-muted-foreground">Duration: {item.duration}</p>
              )}
              {item.instructions && (
                <p className="text-sm mt-1">{item.instructions}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                <span>Prescribed: {format(new Date(item.prescribedDate), "PPP")}</span>
                <span>Refills: {item.refills}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(item)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case "history":
        return (
          <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4" />
                <span className="font-medium">{item.title}</span>
                <Badge variant="outline">{item.category}</Badge>
              </div>
              {item.description && (
                <p className="text-sm mt-1">{item.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                {item.date && <span>Date: {format(new Date(item.date), "PPP")}</span>}
                <span>Added: {format(new Date(item.createdAt), "PPP")}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(item)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <Dialog 
          open={isAddDialogOpen || !!editingItem} 
          onOpenChange={(open) => {
            if (!open) {
              setIsAddDialogOpen(false);
              setEditingItem(null);
              setFormData({});
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? `Edit ${title.slice(0, -1)}` : `Add ${title.slice(0, -1)}`}
              </DialogTitle>
              <DialogDescription>
                Fill in the details below.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {renderFormFields()}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingItem(null);
                    setFormData({});
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={addMutation.isPending || updateMutation.isPending}
                >
                  {(addMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingItem ? "Update" : "Add"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No {title.toLowerCase()} found
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data.map(renderListItem)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}