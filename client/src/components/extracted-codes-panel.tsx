import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  FileCode, 
  Stethoscope, 
  ClipboardCheck,
  AlertTriangle,
  CheckCircle,
  Info,
  Copy,
  Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ICD10Code {
  code: string;
  description: string;
  rationale: string;
  confidence?: 'high' | 'medium' | 'low';
  supporting_text?: string;
}

interface CPTCode {
  code: string;
  description: string;
  modifiers?: string[];
  rationale: string;
  linked_dx?: string;
  confidence?: 'high' | 'medium' | 'low';
}

interface EvaluationCoding {
  em_code?: string;
  em_level?: string;
  mdm_complexity?: string;
  time_spent_minutes?: number | null;
  coding_method?: string;
  justification?: string;
}

interface VerificationReport {
  documented_items?: number;
  inferred_items?: number;
  missing_items?: string[];
  needs_clarification?: string[];
}

interface ExtractedCodesProps {
  icd10Codes: ICD10Code[];
  cptCodes: CPTCode[];
  evaluationCoding?: EvaluationCoding;
  verificationReport?: VerificationReport;
  onCodeEdit?: (type: 'icd10' | 'cpt', index: number, code: ICD10Code | CPTCode) => void;
  onCodeRemove?: (type: 'icd10' | 'cpt', index: number) => void;
}

export function ExtractedCodesPanel({
  icd10Codes = [],
  cptCodes = [],
  evaluationCoding,
  verificationReport,
  onCodeEdit,
  onCodeRemove
}: ExtractedCodesProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
      toast({
        title: "Copied",
        description: `Code ${code} copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy code",
        variant: "destructive",
      });
    }
  };

  const getConfidenceBadge = (confidence?: string) => {
    switch (confidence) {
      case 'high':
        return <Badge className="bg-green-500 text-white text-xs">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500 text-black text-xs">Medium</Badge>;
      case 'low':
        return <Badge className="bg-red-500 text-white text-xs">Low ⚠️</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">N/A</Badge>;
    }
  };

  const hasLowConfidenceCodes = [...icd10Codes, ...cptCodes].some(c => c.confidence === 'low');
  const totalCodes = icd10Codes.length + cptCodes.length;

  if (totalCodes === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground py-4">
            <FileCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No billing codes extracted yet</p>
            <p className="text-xs mt-1">Generate a SOAP note to extract CPT/ICD-10 codes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={hasLowConfidenceCodes ? 'border-yellow-500' : 'border-green-500/30'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Extracted Billing Codes
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {icd10Codes.length} DX
            </Badge>
            <Badge variant="outline">
              {cptCodes.length} CPT
            </Badge>
            {hasLowConfidenceCodes && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge className="bg-yellow-500 text-black">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Review Needed
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Some codes have low confidence and need provider verification</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Verification Summary */}
        {verificationReport && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{verificationReport.documented_items || 0} documented</span>
              </div>
              {(verificationReport.needs_clarification?.length || 0) > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span>{verificationReport.needs_clarification?.length} need clarification</span>
                </div>
              )}
              {(verificationReport.missing_items?.length || 0) > 0 && (
                <div className="flex items-center gap-1">
                  <Info className="h-4 w-4 text-blue-500" />
                  <span>{verificationReport.missing_items?.length} missing items</span>
                </div>
              )}
            </div>
          </div>
        )}

        <Tabs defaultValue="diagnoses" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="diagnoses" className="text-xs sm:text-sm">
              <Stethoscope className="h-4 w-4 mr-1 hidden sm:inline" />
              Diagnoses ({icd10Codes.length})
            </TabsTrigger>
            <TabsTrigger value="procedures" className="text-xs sm:text-sm">
              <ClipboardCheck className="h-4 w-4 mr-1 hidden sm:inline" />
              Procedures ({cptCodes.length})
            </TabsTrigger>
            <TabsTrigger value="evaluation" className="text-xs sm:text-sm">
              E/M Level
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diagnoses" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[80px]">Confidence</TableHead>
                    <TableHead className="w-[60px]">Copy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {icd10Codes.map((dx, i) => (
                    <TableRow key={i} className={dx.confidence === 'low' ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}>
                      <TableCell className="font-mono font-medium">
                        {dx.code}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{dx.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">{dx.rationale}</p>
                          {dx.supporting_text && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">
                              "{dx.supporting_text}"
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getConfidenceBadge(dx.confidence)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(dx.code)}
                        >
                          {copiedCode === dx.code ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {icd10Codes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                        No diagnosis codes extracted
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="procedures" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[100px]">Linked DX</TableHead>
                    <TableHead className="w-[80px]">Confidence</TableHead>
                    <TableHead className="w-[60px]">Copy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cptCodes.map((cpt, i) => (
                    <TableRow key={i} className={cpt.confidence === 'low' ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}>
                      <TableCell className="font-mono font-medium">
                        <div>
                          {cpt.code}
                          {cpt.modifiers && cpt.modifiers.length > 0 && cpt.modifiers[0] !== '' && (
                            <span className="text-xs text-muted-foreground ml-1">
                              -{cpt.modifiers.join(', ')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{cpt.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">{cpt.rationale}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {cpt.linked_dx || '-'}
                      </TableCell>
                      <TableCell>
                        {getConfidenceBadge(cpt.confidence)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(cpt.code)}
                        >
                          {copiedCode === cpt.code ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cptCodes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                        No procedure codes extracted
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="evaluation" className="mt-4">
            {evaluationCoding ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">E/M Code</p>
                    <p className="text-2xl font-bold font-mono">{evaluationCoding.em_code || 'N/A'}</p>
                    <p className="text-sm mt-1">{evaluationCoding.em_level || ''}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">MDM Complexity</p>
                    <p className="text-xl font-medium capitalize">{evaluationCoding.mdm_complexity || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Coding Method: {evaluationCoding.coding_method || 'MDM'}
                    </p>
                  </div>
                </div>
                {evaluationCoding.time_spent_minutes && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Time Spent</p>
                    <p className="text-xl font-medium">{evaluationCoding.time_spent_minutes} minutes</p>
                  </div>
                )}
                {evaluationCoding.justification && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-1">Coding Justification</p>
                    <p className="text-sm text-muted-foreground">{evaluationCoding.justification}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>E/M evaluation coding will appear here after note generation</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Copy All Codes Button */}
        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const allCodes = [
                ...icd10Codes.map(d => d.code),
                ...cptCodes.map(c => c.code)
              ].join(', ');
              copyToClipboard(allCodes);
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy All Codes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
