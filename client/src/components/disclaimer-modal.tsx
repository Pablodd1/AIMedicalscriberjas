import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

export function DisclaimerModal() {
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    // Check if user has already agreed in this session
    const hasAgreed = sessionStorage.getItem("aims_demo_agreed");
    if (!hasAgreed) {
      setOpen(true);
    }
  }, []);

  const handleAgree = () => {
    if (agreed) {
      sessionStorage.setItem("aims_demo_agreed", "true");
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            Experimental Demo Warning
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-4 text-foreground">
            <p className="font-medium">
              This application is an experimental AI demonstration and is NOT a certified medical device.
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>All AI-generated content may contain errors or hallucinations.</li>
              <li>Results must be verified by a licensed healthcare professional.</li>
              <li>Do not use for real clinical decision-making without verification.</li>
              <li>No real patient data should be used in this public demo environment.</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex items-center gap-2 py-4">
          <Checkbox 
            id="agree-terms" 
            checked={agreed} 
            onCheckedChange={(c) => setAgreed(c === true)} 
          />
          <Label htmlFor="agree-terms" className="text-sm cursor-pointer">
            I understand this is an experimental demo and I will verify all outputs.
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={handleAgree} 
            disabled={!agreed}
            className="w-full sm:w-auto"
          >
            Enter Application
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
