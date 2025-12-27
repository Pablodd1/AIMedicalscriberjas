import { log, logError } from './logger';

/**
 * Python Service Integration Layer
 * Provides seamless integration between Node.js backend and Python analytics service
 */

import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import path from 'path';

interface PythonServiceConfig {
  host: string;
  port: number;
  timeout: number;
}

interface LabValue {
  name: string;
  value: number;
  unit: string;
  reference_range_min?: number;
  reference_range_max?: number;
  category?: string;
}

interface LabAnalysisRequest {
  patient_id?: number;
  patient_name?: string;
  lab_values: LabValue[];
  analysis_type?: string;
}

class PythonServiceManager {
  private config: PythonServiceConfig;
  private pythonProcess: ChildProcess | null = null;
  private isServiceRunning = false;

  constructor(config: Partial<PythonServiceConfig> = {}) {
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 8000,
      timeout: config.timeout || 30000
    };
  }

  /**
   * Start the Python analytics service
   */
  async startPythonService(): Promise<boolean> {
    try {
      if (this.isServiceRunning) {
        log('Python service already running');
        return true;
      }

      log('Starting Python analytics service...');

      const pythonServicePath = path.join(process.cwd(), 'python_services', 'main.py');

      // Start Python FastAPI service - use python3 in production/linux, python in local/windows
      const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

      this.pythonProcess = spawn(pythonCommand, [pythonServicePath], {
        env: { ...process.env, PORT: this.config.port.toString() },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle Python service output
      this.pythonProcess.stdout?.on('data', (data) => {
        log(`Python service: ${data.toString()}`);
      });

      this.pythonProcess.stderr?.on('data', (data) => {
        logError(`Python service error: ${data.toString()}`);
      });

      this.pythonProcess.on('close', (code) => {
        log(`Python service exited with code ${code}`);
        this.isServiceRunning = false;
        this.pythonProcess = null;
      });

      // Wait for service to start
      await this.waitForService();
      this.isServiceRunning = true;
      log(`Python analytics service started on port ${this.config.port}`);

      return true;
    } catch (error) {
      logError('Failed to start Python service:', error);
      return false;
    }
  }

  /**
   * Stop the Python analytics service
   */
  stopPythonService(): void {
    if (this.pythonProcess) {
      log('Stopping Python analytics service...');
      this.pythonProcess.kill();
      this.pythonProcess = null;
      this.isServiceRunning = false;
    }
  }

  /**
   * Wait for Python service to be ready
   */
  private async waitForService(maxAttempts = 30): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await axios.get(`http://${this.config.host}:${this.config.port}/health`, {
          timeout: 2000
        });
        return; // Service is ready
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error('Python service failed to start within timeout');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Check if Python service is running
   */
  async isServiceHealthy(): Promise<boolean> {
    try {
      const response = await axios.get(`http://${this.config.host}:${this.config.port}/health`, {
        timeout: 5000
      });
      return response.status === 200 && response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  /**
   * Analyze lab values using Python service
   */
  async analyzeLabs(request: LabAnalysisRequest): Promise<any> {
    try {
      if (!this.isServiceRunning) {
        await this.startPythonService();
      }

      const response = await axios.post(
        `http://${this.config.host}:${this.config.port}/analyze-labs`,
        request,
        { timeout: this.config.timeout }
      );

      return response.data;
    } catch (error) {
      logError('Lab analysis failed:', error);
      throw new Error(`Python service analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect outliers in lab values
   */
  async detectOutliers(request: LabAnalysisRequest): Promise<any> {
    try {
      if (!this.isServiceRunning) {
        await this.startPythonService();
      }

      const response = await axios.post(
        `http://${this.config.host}:${this.config.port}/detect-outliers`,
        request,
        { timeout: this.config.timeout }
      );

      return response.data;
    } catch (error) {
      logError('Outlier detection failed:', error);
      throw new Error(`Python service outlier detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform risk assessment
   */
  async performRiskAssessment(request: LabAnalysisRequest): Promise<any> {
    try {
      if (!this.isServiceRunning) {
        await this.startPythonService();
      }

      const response = await axios.post(
        `http://${this.config.host}:${this.config.port}/risk-assessment`,
        request,
        { timeout: this.config.timeout }
      );

      return response.data;
    } catch (error) {
      logError('Risk assessment failed:', error);
      throw new Error(`Python service risk assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate comprehensive medical insights
   */
  async generateInsights(request: LabAnalysisRequest): Promise<any> {
    try {
      if (!this.isServiceRunning) {
        await this.startPythonService();
      }

      const response = await axios.post(
        `http://${this.config.host}:${this.config.port}/generate-insights`,
        request,
        { timeout: this.config.timeout }
      );

      return response.data;
    } catch (error) {
      logError('Insight generation failed:', error);
      throw new Error(`Python service insight generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze biomarker trends
   */
  async analyzeTrends(patientId: number, biomarker: string, timePeriod: string = '6_months'): Promise<any> {
    try {
      if (!this.isServiceRunning) {
        await this.startPythonService();
      }

      const response = await axios.post(
        `http://${this.config.host}:${this.config.port}/biomarker-trends`,
        {
          patient_id: patientId,
          biomarker,
          time_period: timePeriod
        },
        { timeout: this.config.timeout }
      );

      return response.data;
    } catch (error) {
      logError('Trend analysis failed:', error);
      throw new Error(`Python service trend analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Create singleton instance
export const pythonService = new PythonServiceManager();

// Helper function to parse lab report text into structured data
export function parseLabReportToValues(reportText: string): LabValue[] {
  const labValues: LabValue[] = [];

  // Basic parsing patterns for common lab formats
  const patterns = [
    // Pattern: "TEST_NAME: VALUE (RANGE) UNIT"
    /(\w+(?:\s+\w+)*)\s*:\s*([\d.]+)\s*\(?([\d.]+-[\d.]+)\)?\s*(\w+\/?\w*)/gi,
    // Pattern: "TEST_NAME VALUE UNIT RANGE"
    /(\w+(?:\s+\w+)*)\s+([\d.]+)\s+(\w+\/?\w*)\s*\(?([\d.]+-[\d.]+)\)?/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(reportText)) !== null) {
      const [, name, value, rangeOrUnit, unitOrRange] = match;

      let unit = '';
      let referenceRange = '';

      // Determine which is unit and which is range
      if (rangeOrUnit && rangeOrUnit.includes('-')) {
        referenceRange = rangeOrUnit;
        unit = unitOrRange || '';
      } else {
        unit = rangeOrUnit || '';
        referenceRange = unitOrRange || '';
      }

      // Parse reference range
      let refMin, refMax;
      if (referenceRange && referenceRange.includes('-')) {
        const [min, max] = referenceRange.split('-');
        refMin = parseFloat(min);
        refMax = parseFloat(max);
      }

      labValues.push({
        name: name.trim(),
        value: parseFloat(value),
        unit: unit.trim(),
        reference_range_min: refMin,
        reference_range_max: refMax,
        category: categorizeLabTest(name.trim())
      });
    }
  }

  return labValues;
}

// Helper function to categorize lab tests
function categorizeLabTest(testName: string): string {
  const name = testName.toLowerCase();

  if (name.includes('cholesterol') || name.includes('ldl') || name.includes('hdl') || name.includes('triglyceride')) {
    return 'lipid';
  } else if (name.includes('glucose') || name.includes('hba1c') || name.includes('insulin')) {
    return 'metabolic';
  } else if (name.includes('alt') || name.includes('ast') || name.includes('bilirubin')) {
    return 'liver';
  } else if (name.includes('creatinine') || name.includes('bun') || name.includes('egfr')) {
    return 'kidney';
  } else if (name.includes('tsh') || name.includes('t4') || name.includes('t3')) {
    return 'thyroid';
  } else if (name.includes('wbc') || name.includes('rbc') || name.includes('hemoglobin') || name.includes('hematocrit')) {
    return 'hematology';
  } else if (name.includes('crp') || name.includes('esr')) {
    return 'inflammation';
  }

  return 'general';
}

// Initialize Python service on module load
pythonService.startPythonService().catch(error => {
  logError('Failed to initialize Python service:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  pythonService.stopPythonService();
  process.exit(0);
});

process.on('SIGTERM', () => {
  pythonService.stopPythonService();
  process.exit(0);
});