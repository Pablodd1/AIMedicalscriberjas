import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, 
  AlertTriangle, 
  Pill, 
  FileText, 
  Calendar,
  Heart,
  Activity,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  User,
  History
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PatientContextPanelProps {
  patientId: number | null;
  onContextLoaded?: (context: PatientContext) => void;
}

interface PatientContext {
  patient: {
    id: number;
    name: string;
    age: number | null;
    dateOfBirth: string | null;
    email: string;
    phone: string | null;
    address: string | null;
  };
  medicalHistory: string | null;
  historyEntries: {
    category: string;
    title: string;
    description: string | null;
    date: string | null;
  }[];
  activeMedications: {
    name: string;
    dosage: string;
    frequency: string;
    instructions: string | null;
  }[];
  activeAlerts: {
    type: string;
    severity: string;
    title: string;
    description: string | null;
  }[];
  lastVisit: {
    date: Date;
    title: string;
    type: string;
    contentPreview: string;
  } | null;
  recentNotes: {
    id: number;
    title: string;
    type: string;
    date: Date;
    preview: string;
  }[];
  recentActivity: {
    type: string;
    title: string;
    date: Date;
  }[];
  totalVisits: number;
}

export function PatientContextPanel({ patientId, onContextLoaded }: PatientContextPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAISummary, setShowAISummary] = useState(false);
  const { toast } = useToast();

  // Fetch patient context
  const { data: context, isLoading, error, refetch } = useQuery<{ data: PatientContext }>({
    queryKey: ['/api/ai/patient-context', patientId],
    queryFn: async () => {
      const res = await fetch(`/api/ai/patient-context/${patientId}`);
      if (!res.ok) throw new Error('Failed to fetch patient context');
      return res.json();
    },
    enabled: !!patientId,
  });

  // Generate AI summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ai/pre-consultation-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, patientContext: context?.data })
      });
      if (!res.ok) throw new Error('Failed to generate summary');
      return res.json();
    },
    onSuccess: (data) => {
      setShowAISummary(true);
      toast({
        title: "Summary Generated",
        description: "AI pre-consultation summary is ready",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate AI summary",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (context?.data && onContextLoaded) {
      onContextLoaded(context.data);
    }
  }, [context, onContextLoaded]);

  if (!patientId) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground py-4">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Select a patient to view their consultation context</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading patient context...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !context?.data) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground py-4">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p>Could not load patient context</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { data: patientContext } = context;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <Card className="mb-4 border-primary/20">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Pre-Consultation Summary</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generateSummaryMutation.mutate()}
                disabled={generateSummaryMutation.isPending}
              >
                {generateSummaryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                AI Summary
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CardDescription>
            Patient history and context for {patientContext.patient.name}
            {patientContext.patient.age && ` • ${patientContext.patient.age} years old`}
            {patientContext.totalVisits > 0 && ` • ${patientContext.totalVisits} previous visit(s)`}
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-2">
            {/* AI Generated Summary */}
            {showAISummary && generateSummaryMutation.data?.data?.summary && (
              <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">AI Pre-Consultation Summary</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{generateSummaryMutation.data.data.summary}</p>
              </div>
            )}

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {/* Active Alerts */}
                {patientContext.activeAlerts.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Active Alerts
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {patientContext.activeAlerts.map((alert, i) => (
                        <Badge key={i} className={getSeverityColor(alert.severity)}>
                          {alert.title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Medications */}
                {patientContext.activeMedications.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                      <Pill className="h-4 w-4 text-blue-500" />
                      Current Medications ({patientContext.activeMedications.length})
                    </h4>
                    <div className="space-y-1">
                      {patientContext.activeMedications.slice(0, 5).map((med, i) => (
                        <div key={i} className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{med.name}</span>
                          {' '}{med.dosage} {med.frequency}
                        </div>
                      ))}
                      {patientContext.activeMedications.length > 5 && (
                        <div className="text-sm text-muted-foreground italic">
                          +{patientContext.activeMedications.length - 5} more medications
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Last Visit */}
                {patientContext.lastVisit && (
                  <div>
                    <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-green-500" />
                      Last Visit
                    </h4>
                    <div className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{patientContext.lastVisit.title}</span>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(patientContext.lastVisit.date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {patientContext.lastVisit.type}
                      </Badge>
                      <p className="text-muted-foreground mt-2 text-xs line-clamp-3">
                        {patientContext.lastVisit.contentPreview}
                      </p>
                    </div>
                  </div>
                )}

                {/* Medical History Summary */}
                {patientContext.medicalHistory && (
                  <div>
                    <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      Medical History
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {patientContext.medicalHistory}
                    </p>
                  </div>
                )}

                {/* Recent Notes */}
                {patientContext.recentNotes.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-purple-500" />
                      Recent Notes ({patientContext.recentNotes.length})
                    </h4>
                    <div className="space-y-2">
                      {patientContext.recentNotes.slice(0, 3).map((note, i) => (
                        <div key={i} className="text-sm border-l-2 border-muted pl-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{note.title}</span>
                            <span className="text-muted-foreground text-xs">
                              {format(new Date(note.date), 'MMM d')}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs mt-1">
                            {note.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Activity */}
                {patientContext.recentActivity.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-orange-500" />
                      Recent Activity
                    </h4>
                    <div className="space-y-1">
                      {patientContext.recentActivity.slice(0, 5).map((activity, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>{activity.title}</span>
                          <span className="text-xs">
                            {format(new Date(activity.date), 'MMM d')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Data State */}
                {!patientContext.lastVisit && 
                 patientContext.activeMedications.length === 0 && 
                 patientContext.activeAlerts.length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No previous medical history on file</p>
                    <p className="text-xs">This appears to be a new patient</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
