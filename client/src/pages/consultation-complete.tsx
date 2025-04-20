import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";

export default function ConsultationCompletePage() {
  return (
    <div className="container flex items-center justify-center min-h-screen p-4">
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-2xl">Consultation Complete</CardTitle>
          <CardDescription>
            Thank you for participating in the telemedicine consultation.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p>
            Your virtual consultation has ended successfully. Your doctor will follow up with 
            any additional information, prescriptions, or next steps as discussed in your session.
          </p>
          <p>
            If you have any questions or concerns, please contact your healthcare provider directly.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            className="w-full max-w-xs" 
            onClick={() => window.close()}
          >
            Close Window
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}