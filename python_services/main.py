#!/usr/bin/env python3
"""
Python Medical Analytics Service
Provides advanced medical data analysis capabilities for the AI-Powered Medical Platform
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import json
from typing import List, Dict, Optional, Any
import uvicorn
import os
from datetime import datetime

app = FastAPI(
    title="Medical Analytics Service",
    description="Python-based medical data analysis and visualization service",
    version="1.0.0"
)

# Add CORS middleware to allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class LabValue(BaseModel):
    name: str
    value: float
    unit: str
    reference_range_min: Optional[float] = None
    reference_range_max: Optional[float] = None
    category: Optional[str] = None

class LabAnalysisRequest(BaseModel):
    patient_id: Optional[int] = None
    patient_name: Optional[str] = None
    lab_values: List[LabValue]
    analysis_type: str = "comprehensive"

class LabReport(BaseModel):
    patient_id: Optional[int] = None
    patient_name: Optional[str] = None
    test_date: str
    lab_values: List[Dict[str, Any]]

class TrendAnalysisRequest(BaseModel):
    patient_id: int
    biomarker: str
    time_period: str = "6_months"  # 1_month, 3_months, 6_months, 1_year

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Medical Analytics Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": [
            "/health",
            "/analyze-labs",
            "/detect-outliers", 
            "/biomarker-trends",
            "/risk-assessment",
            "/generate-insights"
        ]
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Lab values analysis
@app.post("/analyze-labs")
async def analyze_lab_values(request: LabAnalysisRequest):
    """
    Analyze lab values and provide statistical insights
    """
    try:
        # Convert lab values to DataFrame for analysis
        lab_data = []
        for lab in request.lab_values:
            lab_data.append({
                'name': lab.name,
                'value': lab.value,
                'unit': lab.unit,
                'ref_min': lab.reference_range_min,
                'ref_max': lab.reference_range_max,
                'category': lab.category or 'general'
            })
        
        df = pd.DataFrame(lab_data)
        
        # Perform statistical analysis
        analysis_results = {
            'patient_info': {
                'patient_id': request.patient_id,
                'patient_name': request.patient_name,
                'analysis_date': datetime.now().isoformat(),
                'total_markers': len(request.lab_values)
            },
            'statistical_summary': {
                'mean_values': df['value'].mean() if not df.empty else 0,
                'std_deviation': df['value'].std() if not df.empty else 0,
                'value_range': {
                    'min': df['value'].min() if not df.empty else 0,
                    'max': df['value'].max() if not df.empty else 0
                }
            },
            'abnormal_markers': [],
            'categories_analysis': {},
            'risk_indicators': []
        }
        
        # Identify abnormal values
        for _, row in df.iterrows():
            if pd.notna(row['ref_min']) and pd.notna(row['ref_max']):
                if row['value'] < row['ref_min'] or row['value'] > row['ref_max']:
                    severity = 'high' if (row['value'] < row['ref_min'] * 0.7 or row['value'] > row['ref_max'] * 1.3) else 'moderate'
                    analysis_results['abnormal_markers'].append({
                        'name': row['name'],
                        'value': row['value'],
                        'unit': row['unit'],
                        'reference_range': f"{row['ref_min']}-{row['ref_max']}",
                        'deviation': 'low' if row['value'] < row['ref_min'] else 'high',
                        'severity': severity,
                        'percentage_deviation': abs((row['value'] - (row['ref_min'] + row['ref_max'])/2) / ((row['ref_max'] - row['ref_min'])/2)) * 100
                    })
        
        # Category analysis
        if not df.empty:
            category_stats = df.groupby('category').agg({
                'value': ['count', 'mean', 'std']
            }).round(2)
            
            for category in df['category'].unique():
                cat_data = df[df['category'] == category]
                analysis_results['categories_analysis'][category] = {
                    'marker_count': len(cat_data),
                    'average_value': cat_data['value'].mean(),
                    'abnormal_count': len([lab for lab in analysis_results['abnormal_markers'] 
                                         if df[df['name'] == lab['name']]['category'].iloc[0] == category])
                }
        
        # Risk assessment
        high_risk_count = len([marker for marker in analysis_results['abnormal_markers'] if marker['severity'] == 'high'])
        moderate_risk_count = len([marker for marker in analysis_results['abnormal_markers'] if marker['severity'] == 'moderate'])
        
        if high_risk_count > 0:
            analysis_results['risk_indicators'].append({
                'level': 'high',
                'description': f'{high_risk_count} markers with significant deviations detected',
                'recommendation': 'Immediate medical consultation recommended'
            })
        elif moderate_risk_count > 2:
            analysis_results['risk_indicators'].append({
                'level': 'moderate',
                'description': f'{moderate_risk_count} markers outside normal ranges',
                'recommendation': 'Follow-up testing and lifestyle modifications suggested'
            })
        else:
            analysis_results['risk_indicators'].append({
                'level': 'low',
                'description': 'Most markers within acceptable ranges',
                'recommendation': 'Continue current health maintenance practices'
            })
        
        return {
            "success": True,
            "data": analysis_results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

# Outlier detection
@app.post("/detect-outliers")
async def detect_outliers(request: LabAnalysisRequest):
    """
    Detect statistical outliers in lab values using Z-score and IQR methods
    """
    try:
        values = [lab.value for lab in request.lab_values]
        names = [lab.name for lab in request.lab_values]
        
        if len(values) < 3:
            return {
                "success": True,
                "data": {
                    "outliers": [],
                    "message": "Insufficient data points for outlier detection (minimum 3 required)"
                }
            }
        
        # Convert to numpy array
        data = np.array(values)
        
        # Z-score method (outliers if |z| > 2)
        z_scores = np.abs((data - np.mean(data)) / np.std(data))
        z_outliers = np.where(z_scores > 2)[0]
        
        # IQR method
        q1 = np.percentile(data, 25)
        q3 = np.percentile(data, 75)
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        iqr_outliers = np.where((data < lower_bound) | (data > upper_bound))[0]
        
        # Combine outlier detection methods
        outlier_indices = list(set(z_outliers) | set(iqr_outliers))
        
        outliers = []
        for idx in outlier_indices:
            outliers.append({
                'name': names[idx],
                'value': values[idx],
                'z_score': z_scores[idx],
                'method': 'both' if idx in z_outliers and idx in iqr_outliers else 
                         'z_score' if idx in z_outliers else 'iqr',
                'severity': 'high' if z_scores[idx] > 3 else 'moderate'
            })
        
        return {
            "success": True,
            "data": {
                "outliers": outliers,
                "statistics": {
                    "total_markers": len(values),
                    "outlier_count": len(outliers),
                    "outlier_percentage": (len(outliers) / len(values)) * 100,
                    "mean": np.mean(data),
                    "std": np.std(data),
                    "q1": q1,
                    "q3": q3,
                    "iqr": iqr
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Outlier detection failed: {str(e)}")

# Biomarker trend analysis
@app.post("/biomarker-trends")
async def analyze_biomarker_trends(request: TrendAnalysisRequest):
    """
    Analyze trends for specific biomarkers over time
    Note: This is a simulation - in real implementation, you'd query historical data
    """
    try:
        # Simulate historical data generation for demonstration
        # In real implementation, this would query your database
        periods = {
            "1_month": 30,
            "3_months": 90, 
            "6_months": 180,
            "1_year": 365
        }
        
        days = periods.get(request.time_period, 180)
        
        # Generate simulated trend data
        dates = pd.date_range(end=datetime.now(), periods=min(days//7, 20), freq='W')
        
        # Simulate values with some trend and noise
        base_value = 100
        trend = np.random.normal(0, 5, len(dates))
        noise = np.random.normal(0, 10, len(dates))
        values = base_value + trend.cumsum() + noise
        
        trend_data = []
        for i, (date, value) in enumerate(zip(dates, values)):
            trend_data.append({
                'date': date.isoformat(),
                'value': round(value, 2),
                'week': i + 1
            })
        
        # Calculate trend statistics
        df = pd.DataFrame({'date': dates, 'value': values})
        
        # Linear regression for trend
        x = np.arange(len(values))
        coefficients = np.polyfit(x, values, 1)
        trend_slope = coefficients[0]
        
        trend_analysis = {
            'patient_id': request.patient_id,
            'biomarker': request.biomarker,
            'time_period': request.time_period,
            'data_points': trend_data,
            'statistics': {
                'current_value': values[-1],
                'average_value': np.mean(values),
                'min_value': np.min(values),
                'max_value': np.max(values),
                'std_deviation': np.std(values),
                'trend_slope': trend_slope,
                'trend_direction': 'increasing' if trend_slope > 0.5 else 'decreasing' if trend_slope < -0.5 else 'stable',
                'volatility': np.std(np.diff(values))
            },
            'insights': []
        }
        
        # Generate insights based on trend
        if abs(trend_slope) > 1:
            direction = "increasing" if trend_slope > 0 else "decreasing"
            trend_analysis['insights'].append({
                'type': 'trend',
                'message': f'{request.biomarker} shows a {direction} trend over {request.time_period}',
                'severity': 'moderate' if abs(trend_slope) < 2 else 'high'
            })
        
        if np.std(values) > np.mean(values) * 0.2:
            trend_analysis['insights'].append({
                'type': 'volatility',
                'message': f'{request.biomarker} shows high variability in recent measurements',
                'severity': 'moderate'
            })
        
        return {
            "success": True,
            "data": trend_analysis
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Trend analysis failed: {str(e)}")

# Risk assessment
@app.post("/risk-assessment")
async def calculate_risk_assessment(request: LabAnalysisRequest):
    """
    Calculate comprehensive risk assessment based on lab values
    """
    try:
        # Risk factors for common conditions
        risk_factors = {
            'cardiovascular': ['cholesterol_total', 'ldl', 'hdl', 'triglycerides', 'crp', 'homocysteine'],
            'diabetes': ['glucose', 'hba1c', 'insulin', 'c_peptide'],
            'liver': ['alt', 'ast', 'bilirubin', 'albumin', 'alp'],
            'kidney': ['creatinine', 'bun', 'egfr', 'protein'],
            'thyroid': ['tsh', 't4', 't3', 'reverse_t3'],
            'inflammation': ['crp', 'esr', 'il6', 'tnf_alpha']
        }
        
        # Normalize lab names for matching
        lab_names = [lab.name.lower().replace(' ', '_').replace('-', '_') for lab in request.lab_values]
        
        risk_scores = {}
        
        for condition, markers in risk_factors.items():
            matching_markers = []
            abnormal_count = 0
            
            for i, lab in enumerate(request.lab_values):
                normalized_name = lab_names[i]
                if any(marker in normalized_name for marker in markers):
                    matching_markers.append(lab.name)
                    
                    # Check if abnormal
                    if lab.reference_range_min and lab.reference_range_max:
                        if lab.value < lab.reference_range_min or lab.value > lab.reference_range_max:
                            abnormal_count += 1
            
            if matching_markers:
                risk_percentage = (abnormal_count / len(matching_markers)) * 100
                risk_level = 'low' if risk_percentage < 25 else 'moderate' if risk_percentage < 50 else 'high'
                
                risk_scores[condition] = {
                    'risk_percentage': risk_percentage,
                    'risk_level': risk_level,
                    'markers_evaluated': matching_markers,
                    'abnormal_markers': abnormal_count,
                    'total_markers': len(matching_markers)
                }
        
        # Overall health score
        if risk_scores:
            avg_risk = np.mean([score['risk_percentage'] for score in risk_scores.values()])
            overall_health_score = max(0, 100 - avg_risk)
        else:
            overall_health_score = 85  # Default score when no specific risk factors found
        
        return {
            "success": True,
            "data": {
                'patient_id': request.patient_id,
                'overall_health_score': round(overall_health_score, 1),
                'risk_assessments': risk_scores,
                'recommendations': generate_health_recommendations(risk_scores),
                'assessment_date': datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk assessment failed: {str(e)}")

def generate_health_recommendations(risk_scores):
    """Generate personalized health recommendations based on risk scores"""
    recommendations = []
    
    for condition, risk_data in risk_scores.items():
        if risk_data['risk_level'] == 'high':
            recommendations.append({
                'category': condition,
                'priority': 'high',
                'action': f'Immediate consultation recommended for {condition} risk factors',
                'details': f'{risk_data["abnormal_markers"]} out of {risk_data["total_markers"]} markers abnormal'
            })
        elif risk_data['risk_level'] == 'moderate':
            recommendations.append({
                'category': condition,
                'priority': 'moderate', 
                'action': f'Monitor and lifestyle modifications for {condition} health',
                'details': f'Some {condition} markers outside optimal ranges'
            })
    
    # General recommendations
    if not any(risk['risk_level'] == 'high' for risk in risk_scores.values()):
        recommendations.append({
            'category': 'general',
            'priority': 'low',
            'action': 'Continue healthy lifestyle practices',
            'details': 'Most health markers within acceptable ranges'
        })
    
    return recommendations

# Generate medical insights
@app.post("/generate-insights")
async def generate_medical_insights(request: LabAnalysisRequest):
    """
    Generate comprehensive medical insights combining multiple analysis methods
    """
    try:
        # Run multiple analyses
        analysis_result = await analyze_lab_values(request)
        outlier_result = await detect_outliers(request)
        risk_result = await calculate_risk_assessment(request)
        
        # Combine insights
        combined_insights = {
            'patient_info': {
                'patient_id': request.patient_id,
                'patient_name': request.patient_name,
                'analysis_date': datetime.now().isoformat(),
                'total_markers_analyzed': len(request.lab_values)
            },
            'executive_summary': {
                'overall_health_score': risk_result['data']['overall_health_score'],
                'abnormal_markers_count': len(analysis_result['data']['abnormal_markers']),
                'outliers_detected': len(outlier_result['data']['outliers']),
                'high_risk_areas': len([r for r in risk_result['data']['risk_assessments'].values() if r['risk_level'] == 'high'])
            },
            'detailed_analysis': {
                'statistical_analysis': analysis_result['data'],
                'outlier_detection': outlier_result['data'],
                'risk_assessment': risk_result['data']
            },
            'actionable_insights': [],
            'follow_up_recommendations': []
        }
        
        # Generate actionable insights
        if combined_insights['executive_summary']['high_risk_areas'] > 0:
            combined_insights['actionable_insights'].append({
                'priority': 'high',
                'insight': 'Multiple high-risk areas identified requiring immediate attention',
                'action': 'Schedule comprehensive medical evaluation within 1-2 weeks'
            })
        
        if combined_insights['executive_summary']['outliers_detected'] > 2:
            combined_insights['actionable_insights'].append({
                'priority': 'moderate',
                'insight': 'Several biomarkers show unusual patterns',
                'action': 'Repeat testing to confirm values and investigate underlying causes'
            })
        
        # Follow-up recommendations
        combined_insights['follow_up_recommendations'] = [
            'Retest abnormal markers in 4-6 weeks',
            'Consider comprehensive metabolic panel if not recently done',
            'Lifestyle modifications based on identified risk factors',
            'Regular monitoring of trending biomarkers'
        ]
        
        return {
            "success": True,
            "data": combined_insights
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Insight generation failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)