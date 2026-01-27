import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Clock, 
  AlertCircle,
  CheckCircle,
  BarChart3,
  Mic,
  FileText,
  Settings
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface VoiceMetrics {
  sessionId: string;
  userId: string;
  patientId?: string;
  doctorId?: string;
  timestamp: Date;
  duration: number;
  wordCount: number;
  confidence: number;
  transcriptionProvider: string;
  recordingQuality: number;
  backgroundNoise: number;
  processingTime: number;
  errorCount: number;
  retryCount: number;
  cacheHit: boolean;
  language: string;
  medicalContext: boolean;
  featuresUsed: string[];
}

interface VoiceUsageStats {
  totalRecordings: number;
  totalTranscriptions: number;
  averageDuration: number;
  averageConfidence: number;
  totalWords: number;
  uniqueUsers: number;
  errorRate: number;
  mostUsedProvider: string;
  peakUsageHour: number;
  cacheHitRate: number;
  medicalTermAccuracy: number;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: {
    totalActiveSessions: number;
    sessionsLastHour: number;
    averageResponseTime: number;
    errorRate24h: number;
    cacheHitRate24h: number;
    systemLoad: number;
  };
  recommendations: string[];
}

interface VoiceMonitoringDashboardProps {
  className?: string;
  refreshInterval?: number;
  enableRealTimeUpdates?: boolean;
}

export const VoiceMonitoringDashboard: React.FC<VoiceMonitoringDashboardProps> = ({
  className = '',
  refreshInterval = 30000, // 30 seconds
  enableRealTimeUpdates = true
}) => {
  const [voiceStats, setVoiceStats] = useState<VoiceUsageStats | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [recentSessions, setRecentSessions] = useState<VoiceMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Fetch data from API
  const fetchVoiceStats = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '1h':
          startDate.setHours(startDate.getHours() - 1);
          break;
        case '24h':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
      }

      const [statsResponse, healthResponse, sessionsResponse] = await Promise.all([
        fetch('/api/voice-analytics/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start: startDate, end: endDate })
        }),
        fetch('/api/voice-analytics/system-health'),
        fetch('/api/voice-analytics/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            start: new Date(Date.now() - 24 * 60 * 60 * 1000), 
            end: new Date(),
            limit: 50 
          })
        })
      ]);

      if (statsResponse.ok && healthResponse.ok && sessionsResponse.ok) {
        const [statsData, healthData, sessionsData] = await Promise.all([
          statsResponse.json(),
          healthResponse.json(),
          sessionsResponse.json()
        ]);

        setVoiceStats(statsData.data);
        setSystemHealth(healthData.data);
        setRecentSessions(sessionsData.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch voice analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVoiceStats();

    if (enableRealTimeUpdates) {
      const interval = setInterval(fetchVoiceStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [timeRange, refreshInterval, enableRealTimeUpdates]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  const prepareChartData = () => {
    if (!voiceStats || !recentSessions.length) return [];

    // Group sessions by hour for the last 24 hours
    const hourlyData = new Map<string, { sessions: number; avgConfidence: number; errors: number }>();
    
    for (let i = 23; i >= 0; i--) {
      const hour = new Date();
      hour.setHours(hour.getHours() - i, 0, 0, 0);
      const hourKey = hour.toISOString().slice(11, 13);
      hourlyData.set(hourKey, { sessions: 0, avgConfidence: 0, errors: 0 });
    }

    recentSessions.forEach(session => {
      const hourKey = new Date(session.timestamp).toISOString().slice(11, 13);
      const current = hourlyData.get(hourKey) || { sessions: 0, avgConfidence: 0, errors: 0 };
      
      hourlyData.set(hourKey, {
        sessions: current.sessions + 1,
        avgConfidence: ((current.avgConfidence * current.sessions) + session.confidence) / (current.sessions + 1),
        errors: current.errors + session.errorCount
      });
    });

    return Array.from(hourlyData.entries()).map(([hour, data]) => ({
      hour: `${hour}:00`,
      sessions: data.sessions,
      confidence: Math.round(data.avgConfidence * 100),
      errors: data.errors
    }));
  };

  const prepareProviderData = () => {
    if (!voiceStats || !recentSessions.length) return [];

    const providerCounts = recentSessions.reduce((acc, session) => {
      acc[session.transcriptionProvider] = (acc[session.transcriptionProvider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(providerCounts).map(([provider, count]) => ({
      name: provider,
      value: count,
      percentage: Math.round((count / recentSessions.length) * 100)
    }));
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (isLoading && !voiceStats) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-96">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Loading voice analytics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Mic className="h-6 w-6" />
          Voice Recording Analytics
        </h2>
        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button
            onClick={fetchVoiceStats}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            ) : (
              <Activity className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Status */}
      {systemHealth && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>System Health</span>
              <Badge className={getStatusColor(systemHealth.status)}>
                {systemHealth.status.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {systemHealth.metrics.totalActiveSessions}
                </div>
                <div className="text-sm text-gray-600">Active Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {systemHealth.metrics.sessionsLastHour}
                </div>
                <div className="text-sm text-gray-600">Last Hour</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {Math.round(systemHealth.metrics.averageResponseTime)}ms
                </div>
                <div className="text-sm text-gray-600">Avg Response</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {(systemHealth.metrics.errorRate24h * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Error Rate</div>
              </div>
            </div>
            
            {systemHealth.recommendations.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <h4 className="font-medium text-yellow-800 mb-2">Recommendations:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {systemHealth.recommendations.map((rec, index) => (
                    <li key={index}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      {voiceStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Recordings</p>
                  <p className="text-2xl font-bold">{voiceStats.totalRecordings}</p>
                </div>
                <Mic className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Confidence</p>
                  <p className={`text-2xl font-bold ${getConfidenceColor(voiceStats.averageConfidence)}`}>
                    {(voiceStats.averageConfidence * 100).toFixed(1)}%
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Error Rate</p>
                  <p className="text-2xl font-bold text-red-600">
                    {(voiceStats.errorRate * 100).toFixed(1)}%
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cache Hit Rate</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {(voiceStats.cacheHitRate * 100).toFixed(1)}%
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <Tabs defaultValue="sessions" className="mb-6">
        <TabsList>
          <TabsTrigger value="sessions">Session Activity</TabsTrigger>
          <TabsTrigger value="providers">Provider Usage</TabsTrigger>
          <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Session Activity (Last 24 Hours)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={prepareChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sessions" stroke="#3B82F6" strokeWidth={2} />
                  <Line type="monotone" dataKey="confidence" stroke="#10B981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers">
          <Card>
            <CardHeader>
              <CardTitle>Transcription Provider Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={prepareProviderData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {prepareProviderData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality">
          <Card>
            <CardHeader>
              <CardTitle>Quality Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={prepareChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="confidence" fill="#10B981" />
                  <Bar dataKey="errors" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Recent Sessions</span>
            <span className="text-sm font-normal text-gray-600">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentSessions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No recent sessions found</p>
            ) : (
              recentSessions.slice(0, 10).map((session) => (
                <div key={session.sessionId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Mic className="h-4 w-4 text-gray-600" />
                      <span className="font-medium">{session.userId}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(session.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="text-sm text-gray-600">
                      {session.duration}s • {session.wordCount} words
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline">{session.transcriptionProvider}</Badge>
                    <Badge className={getConfidenceColor(session.confidence)}>
                      {(session.confidence * 100).toFixed(0)}%
                    </Badge>
                    {session.errorCount > 0 && (
                      <Badge variant="destructive">{session.errorCount} errors</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceMonitoringDashboard;