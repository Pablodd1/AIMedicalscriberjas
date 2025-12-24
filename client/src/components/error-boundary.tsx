import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw, Home } from "lucide-react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    private handleGoHome = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = "/";
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4">
                    <Card className="max-w-md w-full shadow-lg border-red-100">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle className="h-6 w-6 text-red-600" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-slate-900">Something went wrong</CardTitle>
                            <CardDescription>
                                An unexpected error occurred in the application.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4 text-center">
                            <div className="p-4 bg-slate-100 rounded-md text-sm font-mono text-left overflow-auto max-h-32 text-slate-700">
                                {this.state.error?.message || "Unknown error"}
                            </div>
                            <p className="text-sm text-slate-500 italic">
                                Our team has been notified. You can try refreshing the page or returning home.
                            </p>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2 pt-2">
                            <Button
                                onClick={this.handleReset}
                                className="w-full flex items-center justify-center gap-2"
                                variant="default"
                            >
                                <RefreshCcw className="h-4 w-4" />
                                Refresh Page
                            </Button>
                            <Button
                                onClick={this.handleGoHome}
                                variant="outline"
                                className="w-full flex items-center justify-center gap-2"
                            >
                                <Home className="h-4 w-4" />
                                Go to Home
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
