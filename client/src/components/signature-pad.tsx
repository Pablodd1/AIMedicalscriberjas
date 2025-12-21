import { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Pen, 
  Eraser, 
  Check, 
  X, 
  Download, 
  Calendar,
  Shield,
  FileSignature,
  Clock,
  User,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SignaturePadProps {
  onSignatureComplete?: (signatureData: SignatureData) => void;
  documentTitle?: string;
  documentType?: 'medical_note' | 'prescription' | 'consent' | 'consultation' | 'intake' | 'general';
  patientName?: string;
  requireWitness?: boolean;
  showTimestamp?: boolean;
  compact?: boolean;
}

export interface SignatureData {
  signatureImage: string; // Base64 PNG
  signerName: string;
  signerRole: string;
  signerId: number;
  timestamp: string;
  ipAddress?: string;
  documentType: string;
  documentTitle: string;
  attestation: string;
  witnessName?: string;
  witnessSignature?: string;
}

export function SignaturePad({
  onSignatureComplete,
  documentTitle = 'Medical Document',
  documentType = 'general',
  patientName,
  requireWitness = false,
  showTimestamp = true,
  compact = false
}: SignaturePadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [witnessName, setWitnessName] = useState('');

  useEffect(() => {
    if (user?.name) {
      setTypedName(user.name);
    }
  }, [user]);

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setHasDrawn(false);
  };

  const getAttestationText = () => {
    switch (documentType) {
      case 'medical_note':
        return `I, ${typedName || '[Provider Name]'}, hereby certify that this medical note accurately reflects my clinical assessment and treatment plan for ${patientName || 'the patient'}.`;
      case 'prescription':
        return `I, ${typedName || '[Provider Name]'}, hereby authorize this prescription and confirm it is medically necessary for ${patientName || 'the patient'}.`;
      case 'consent':
        return `I acknowledge that I have reviewed and agree to the terms outlined in this consent form.`;
      case 'consultation':
        return `I, ${typedName || '[Provider Name]'}, certify that this consultation note accurately documents the telemedicine encounter with ${patientName || 'the patient'}.`;
      case 'intake':
        return `I certify that the information provided in this intake form is accurate and complete to the best of my knowledge.`;
      default:
        return `I hereby acknowledge and sign this document on ${format(new Date(), 'MMMM d, yyyy')}.`;
    }
  };

  const handleSignatureEnd = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      setHasDrawn(true);
    }
  };

  const handleComplete = () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      toast({
        title: 'Signature Required',
        description: 'Please draw your signature before completing.',
        variant: 'destructive'
      });
      return;
    }

    if (!attestationChecked) {
      toast({
        title: 'Attestation Required',
        description: 'Please check the attestation box to confirm.',
        variant: 'destructive'
      });
      return;
    }

    if (!typedName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please type your name to confirm your identity.',
        variant: 'destructive'
      });
      return;
    }

    const signatureImage = sigCanvas.current.toDataURL('image/png');
    
    const signatureData: SignatureData = {
      signatureImage,
      signerName: typedName,
      signerRole: user?.role || 'unknown',
      signerId: user?.id || 0,
      timestamp: new Date().toISOString(),
      documentType,
      documentTitle,
      attestation: getAttestationText(),
      witnessName: requireWitness ? witnessName : undefined,
    };

    onSignatureComplete?.(signatureData);
    
    toast({
      title: 'Document Signed',
      description: `${documentTitle} has been electronically signed.`,
    });

    setIsOpen(false);
    clearSignature();
    setAttestationChecked(false);
  };

  const downloadSignature = () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return;
    
    const link = document.createElement('a');
    link.download = `signature_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.png`;
    link.href = sigCanvas.current.toDataURL('image/png');
    link.click();
  };

  if (compact) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <FileSignature className="h-4 w-4" />
            Sign Document
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Electronic Signature - {documentTitle}
            </DialogTitle>
            <DialogDescription>
              Sign this document electronically. Your signature will be legally binding.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Signature Canvas */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 bg-white">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{
                  className: 'w-full h-40 cursor-crosshair',
                  style: { width: '100%', height: '160px' }
                }}
                penColor="#0F2A5C"
                onEnd={handleSignatureEnd}
              />
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearSignature}>
                <Eraser className="h-4 w-4 mr-1" /> Clear
              </Button>
              <Button variant="outline" size="sm" onClick={downloadSignature} disabled={!hasDrawn}>
                <Download className="h-4 w-4 mr-1" /> Download
              </Button>
            </div>

            {/* Typed Name */}
            <div>
              <Label htmlFor="typedName">Type Your Full Name</Label>
              <Input
                id="typedName"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Enter your legal name"
              />
            </div>

            {/* Attestation */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <Checkbox 
                  id="attestation" 
                  checked={attestationChecked}
                  onCheckedChange={(checked) => setAttestationChecked(checked as boolean)}
                />
                <Label htmlFor="attestation" className="text-sm leading-relaxed cursor-pointer">
                  {getAttestationText()}
                </Label>
              </div>
            </div>

            {/* Timestamp */}
            {showTimestamp && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(), 'MMMM d, yyyy')}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(new Date(), 'h:mm a')}
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {user?.name || 'Unknown'}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleComplete}
              disabled={!hasDrawn || !attestationChecked || !typedName.trim()}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              Complete Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Electronic Signature
        </CardTitle>
        <CardDescription>
          Sign {documentTitle} electronically. This signature is legally binding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Document Info */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><strong>Document:</strong> {documentTitle}</div>
            <div><strong>Type:</strong> {documentType.replace('_', ' ').toUpperCase()}</div>
            {patientName && <div><strong>Patient:</strong> {patientName}</div>}
            <div><strong>Provider:</strong> {user?.name || 'Unknown'}</div>
          </div>
        </div>

        {/* Signature Canvas */}
        <div>
          <Label className="mb-2 block">Draw Your Signature</Label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 bg-white relative">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                className: 'w-full cursor-crosshair',
                style: { width: '100%', height: '200px' }
              }}
              penColor="#0F2A5C"
              onEnd={handleSignatureEnd}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-gray-400 flex items-center gap-2">
                  <Pen className="h-5 w-5" />
                  Sign here
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={clearSignature}>
              <Eraser className="h-4 w-4 mr-1" /> Clear
            </Button>
            <Button variant="outline" size="sm" onClick={downloadSignature} disabled={!hasDrawn}>
              <Download className="h-4 w-4 mr-1" /> Download
            </Button>
          </div>
        </div>

        {/* Typed Name */}
        <div>
          <Label htmlFor="fullTypedName">Type Your Full Legal Name</Label>
          <Input
            id="fullTypedName"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Enter your name exactly as it appears on your credentials"
            className="mt-1"
          />
        </div>

        {/* Witness (if required) */}
        {requireWitness && (
          <div>
            <Label htmlFor="witnessName">Witness Name</Label>
            <Input
              id="witnessName"
              value={witnessName}
              onChange={(e) => setWitnessName(e.target.value)}
              placeholder="Enter witness name"
              className="mt-1"
            />
          </div>
        )}

        {/* Attestation */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Checkbox 
              id="fullAttestation" 
              checked={attestationChecked}
              onCheckedChange={(checked) => setAttestationChecked(checked as boolean)}
              className="mt-1"
            />
            <div>
              <Label htmlFor="fullAttestation" className="cursor-pointer font-medium">
                Attestation & Certification
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {getAttestationText()}
              </p>
            </div>
          </div>
        </div>

        {/* Legal Notice */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            By signing this document electronically, you agree that your electronic signature 
            is the legal equivalent of your handwritten signature. This signature complies with 
            ESIGN Act and UETA regulations.
          </p>
        </div>

        {/* Timestamp */}
        {showTimestamp && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-3">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(new Date(), 'MMMM d, yyyy')}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {format(new Date(), 'h:mm:ss a zzz')}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={clearSignature}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button 
          onClick={handleComplete}
          disabled={!hasDrawn || !attestationChecked || !typedName.trim()}
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          Sign & Complete
        </Button>
      </CardFooter>
    </Card>
  );
}

// Signature Display Component - shows a completed signature
interface SignatureDisplayProps {
  signatureData: SignatureData;
  showDetails?: boolean;
}

export function SignatureDisplay({ signatureData, showDetails = true }: SignatureDisplayProps) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-start gap-4">
        <img 
          src={signatureData.signatureImage} 
          alt="Electronic Signature" 
          className="h-16 border-b-2 border-primary"
        />
        <div className="flex-1">
          <div className="font-medium">{signatureData.signerName}</div>
          <div className="text-sm text-muted-foreground capitalize">
            {signatureData.signerRole}
          </div>
          {showDetails && (
            <div className="text-xs text-muted-foreground mt-1">
              Signed: {format(new Date(signatureData.timestamp), 'MMM d, yyyy h:mm a')}
            </div>
          )}
        </div>
        <Shield className="h-5 w-5 text-green-600" />
      </div>
      {showDetails && (
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
          <p className="italic">"{signatureData.attestation}"</p>
        </div>
      )}
    </div>
  );
}

export default SignaturePad;
