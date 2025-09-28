import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Zap, Thermometer } from 'lucide-react';
import { apiService, wsService } from '@/lib/api';

export const SystemMetrics = () => {
  const [metrics, setMetrics] = useState({
    cpu: 0,
    memory: 0,
    disk: 0,
    temp: 0,
  });

  useEffect(() => {
    // Fetch initial metrics
    const fetchMetrics = async () => {
      try {
        const data = await apiService.getSystemMetrics();
        setMetrics({
          cpu: data.cpu || 0,
          memory: data.memory || 0,
          disk: data.disk || 0,
          temp: data.temperature || 0,
        });
      } catch (error) {
        console.error('Failed to fetch system metrics:', error);
      }
    };

    fetchMetrics();

    // Listen for real-time updates via WebSocket
    wsService.on('system_metrics', (data: any) => {
      setMetrics({
        cpu: data.cpu || 0,
        memory: data.memory || 0,
        disk: data.disk || 0,
        temp: data.temperature || 0,
      });
    });

    // Fallback polling every 10 seconds
    const interval = setInterval(fetchMetrics, 10000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (value: number, threshold: number) => {
    if (value < threshold) return 'jarvis-status-online';
    if (value < threshold * 1.5) return 'jarvis-status-warning';
    return 'jarvis-status-critical';
  };

  const metricItems = [
    {
      icon: Cpu,
      label: 'CPU',
      value: metrics.cpu,
      unit: '%',
      threshold: 80,
    },
    {
      icon: HardDrive,
      label: 'Memory',
      value: metrics.memory,
      unit: '%',
      threshold: 85,
    },
    {
      icon: Zap,
      label: 'Disk',
      value: metrics.disk,
      unit: '%',
      threshold: 90,
    },
    {
      icon: Thermometer,
      label: 'Temp',
      value: metrics.temp,
      unit: '°C',
      threshold: 70,
    },
  ];

  return (
    <div className="space-y-3">
      {metricItems.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.label} className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{metric.label}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-16 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${getStatusColor(metric.value, metric.threshold)} bg-current`}
                  style={{ width: `${Math.min(metric.value, 100)}%` }}
                />
              </div>
              <span className={`text-xs jarvis-mono ${getStatusColor(metric.value, metric.threshold)}`}>
                {metric.value}{metric.unit}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};