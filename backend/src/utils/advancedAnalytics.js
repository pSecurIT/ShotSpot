/**
 * Advanced Analytics Utility Functions
 * Helper functions for generating comprehensive reports
 */

/**
 * Generate a complete player performance report
 * Combines predictions, benchmarking, and historical data
 * 
 * @param {number} playerId - Player ID
 * @param {number} opponentId - Optional opponent ID for predictions
 * @returns {Object} Complete player report
 */
export async function generatePlayerReport(playerId, opponentId = null) {
  const baseUrl = process.env.API_BASE_URL;
  
  if (!baseUrl) {
    throw new Error('API_BASE_URL environment variable is not set');
  }
  
  try {
    // Fetch all relevant data in parallel with error handling
    const [formTrends, fatigue, prediction, comparison, historical] = await Promise.all([
      fetch(`${baseUrl}/predictions/form-trends/${playerId}`).then(async r => {
        if (!r.ok) {
          const errorText = await r.text().catch(() => 'Unable to read response');
          throw new Error(`Form trends request failed with status ${r.status}: ${errorText}`);
        }
        return r.json();
      }),
      fetch(`${baseUrl}/predictions/fatigue/${playerId}`).then(async r => {
        if (!r.ok) {
          const errorText = await r.text().catch(() => 'Unable to read response');
          throw new Error(`Fatigue request failed with status ${r.status}: ${errorText}`);
        }
        return r.json();
      }),
      fetch(`${baseUrl}/predictions/next-game/${playerId}${opponentId ? `?opponent_id=${opponentId}` : ''}`).then(async r => {
        if (!r.ok) {
          const errorText = await r.text().catch(() => 'Unable to read response');
          throw new Error(`Prediction request failed with status ${r.status}: ${errorText}`);
        }
        return r.json();
      }),
      fetch(`${baseUrl}/benchmarks/player-comparison/${playerId}`).then(async r => {
        if (!r.ok) {
          const errorText = await r.text().catch(() => 'Unable to read response');
          throw new Error(`Comparison request failed with status ${r.status}: ${errorText}`);
        }
        return r.json();
      }),
      fetch(`${baseUrl}/benchmarks/historical/player/${playerId}`).then(async r => {
        if (!r.ok) {
          const errorText = await r.text().catch(() => 'Unable to read response');
          throw new Error(`Historical request failed with status ${r.status}: ${errorText}`);
        }
        return r.json();
      })
    ]);

    return {
      player_id: playerId,
      report_type: 'comprehensive_player_analysis',
      generated_at: new Date().toISOString(),
      performance_predictions: {
        form_trends: formTrends,
        fatigue_analysis: fatigue,
        next_game_prediction: prediction
      },
      benchmarking: {
        league_comparison: comparison,
        historical_performance: historical
      },
      summary: {
        current_form: formTrends.form_trend,
        fatigue_level: fatigue.fatigue_analysis?.[0]?.fatigue_level,
        predicted_next_game_fg: prediction.predicted_fg_percentage,
        vs_league_average: comparison.comparison?.fg_vs_league,
        confidence_score: prediction.confidence_score
      }
    };
  } catch (error) {
    console.error('Error generating player report:', error);
    throw new Error('Failed to generate player report');
  }
}

/**
 * Generate highlight reel data for a game
 * 
 * @param {number} gameId - Game ID
 * @param {number} maxClips - Maximum number of clips
 * @returns {Object} Highlight reel data
 */
export async function generateHighlightReel(gameId, maxClips = 20) {
  const baseUrl = process.env.API_BASE_URL;
  
  if (!baseUrl) {
    throw new Error('API_BASE_URL environment variable is not set');
  }
  
  try {
    const response = await fetch(`${baseUrl}/video/highlights/${gameId}?max_clips=${maxClips}`);
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read response');
      throw new Error(`Highlight reel request failed with status ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    
    return {
      game_id: gameId,
      generated_at: new Date().toISOString(),
      highlight_data: data,
      total_duration_seconds: data.reel_metadata?.suggested_total_duration || 0,
      clip_count: data.total_clips,
      clips: [
        ...data.marked_highlights.map(h => ({
          type: 'marked',
          timestamp_start: h.timestamp_start,
          timestamp_end: h.timestamp_end,
          event_type: h.event_type,
          description: h.description
        })),
        ...data.auto_identified_highlights.map(h => ({
          type: 'auto',
          event_type: h.event_type,
          description: h.description,
          priority: h.priority,
          suggested_duration: h.suggested_duration
        }))
      ]
    };
  } catch (error) {
    console.error('Error generating highlight reel:', error);
    throw new Error('Failed to generate highlight reel');
  }
}

/**
 * Generate team benchmarking report
 * 
 * @param {number} teamId - Team ID
 * @param {string} position - Position filter ('offense', 'defense', 'all')
 * @returns {Object} Team benchmarking data
 */
export async function generateTeamBenchmarkReport(teamId, position = 'all') {
  const baseUrl = process.env.API_BASE_URL;
  
  if (!baseUrl) {
    throw new Error('API_BASE_URL environment variable is not set');
  }
  
  try {
    const [leagueAvg, teamHistorical] = await Promise.all([
      fetch(`${baseUrl}/benchmarks/league-averages?position=${position}`).then(async r => {
        if (!r.ok) {
          const errorText = await r.text().catch(() => 'Unable to read response');
          throw new Error(`League averages request failed with status ${r.status}: ${errorText}`);
        }
        return r.json();
      }),
      fetch(`${baseUrl}/benchmarks/historical/team/${teamId}`).then(async r => {
        if (!r.ok) {
          const errorText = await r.text().catch(() => 'Unable to read response');
          throw new Error(`Team historical request failed with status ${r.status}: ${errorText}`);
        }
        return r.json();
      })
    ]);

    return {
      team_id: teamId,
      report_type: 'team_benchmark_analysis',
      generated_at: new Date().toISOString(),
      position_filter: position,
      league_benchmarks: leagueAvg,
      team_historical: teamHistorical,
      comparison: {
        // This would require team-specific calculations
        // Add team stats comparison logic here
      }
    };
  } catch (error) {
    console.error('Error generating team benchmark report:', error);
    throw new Error('Failed to generate team benchmark report');
  }
}

/**
 * Calculate percentile rank for a metric
 * Internal helper function
 * 
 * @param {number} value - Value to rank
 * @param {Array} dataset - Array of values to compare against
 * @returns {number} Percentile rank (0-100)
 */
export function calculatePercentileRank(value, dataset) {
  if (!dataset || dataset.length === 0) return 50;
  
  const sorted = [...dataset].sort((a, b) => a - b);
  const rank = sorted.filter(v => v < value).length;
  return (rank / sorted.length) * 100;
}

/**
 * Determine trend direction from time series data
 * 
 * @param {Array} dataPoints - Array of { value, date } objects
 * @returns {string} Trend direction: 'improving', 'declining', 'stable'
 */
export function determineTrend(dataPoints) {
  if (!dataPoints || dataPoints.length < 2) return 'stable';
  
  // Simple linear regression
  const n = dataPoints.length;
  const xValues = dataPoints.map((_, i) => i);
  const yValues = dataPoints.map(d => d.value);
  
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  
  if (Math.abs(slope) < 0.5) return 'stable';
  return slope > 0 ? 'improving' : 'declining';
}

/**
 * Format report data for PDF generation
 * 
 * @param {Object} reportData - Raw report data
 * @returns {Object} Formatted data for PDF
 */
export function formatForPDF(reportData) {
  return {
    metadata: {
      title: `Advanced Analytics Report`,
      generated_at: new Date().toISOString(),
      report_version: '1.0'
    },
    content: {
      ...reportData,
      charts_data: extractChartsData(reportData),
      summary_text: generateSummaryText(reportData)
    }
  };
}

/**
 * Extract data suitable for chart generation
 * Internal helper
 */
function extractChartsData(reportData) {
  const charts = [];
  
  // Form trends chart
  if (reportData.performance_predictions?.form_trends?.recent_games) {
    charts.push({
      type: 'line',
      title: 'Performance Trend',
      data: reportData.performance_predictions.form_trends.recent_games.map(g => ({
        x: g.game_date,
        y: g.fg_percentage
      }))
    });
  }
  
  // Historical comparison chart
  if (reportData.benchmarking?.historical_performance?.historical_benchmarks) {
    charts.push({
      type: 'bar',
      title: 'Historical Performance',
      data: reportData.benchmarking.historical_performance.historical_benchmarks.map(b => ({
        x: b.period,
        y: b.avg_fg_percentage
      }))
    });
  }
  
  return charts;
}

/**
 * Generate natural language summary from report data
 * Internal helper
 */
function generateSummaryText(reportData) {
  const summary = [];
  
  if (reportData.summary) {
    const { current_form, fatigue_level, predicted_next_game_fg, vs_league_average } = reportData.summary;
    
    summary.push(`Player is currently in ${current_form} form.`);
    
    if (fatigue_level) {
      summary.push(`Fatigue level is ${fatigue_level}.`);
    }
    
    if (predicted_next_game_fg) {
      summary.push(`Predicted field goal percentage for next game: ${predicted_next_game_fg}%.`);
    }
    
    if (vs_league_average) {
      const comparison = vs_league_average > 0 ? 'above' : 'below';
      summary.push(`Performing ${Math.abs(vs_league_average).toFixed(1)}% ${comparison} league average.`);
    }
  }
  
  return summary.join(' ');
}

export default {
  generatePlayerReport,
  generateHighlightReel,
  generateTeamBenchmarkReport,
  calculatePercentileRank,
  determineTrend,
  formatForPDF
};
